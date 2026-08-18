import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationActorContextCreate } from "../../authorization/domain/authorizationActorContextCreate.js"
import type { AuthorizationActorContext } from "../../authorization/public/authorizationActorContextSchema.js"
import { sessionCredentialHashCreate } from "../domain/sessionCredentialHashCreate.js"
import { sessionPublicViewCreate } from "../domain/sessionPublicViewCreate.js"
import type { Session } from "../public/sessionSchema.js"
import { sessionRepositoryCreate } from "../persistence/sessionRepositoryCreate.js"
import { userTable } from "../../users/persistence/userTable.js"
import { and, eq } from "drizzle-orm"
import * as v from "valibot"
import { realmBootstrapAdminTable } from "../../realms/persistence/realmBootstrapAdminTable.js"
import { authorizationPermissionSchema } from "../../authorization/public/authorizationPermissionSchema.js"

type SessionAuthenticateOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly token: string
}

type SessionAuthentication = {
  readonly actor: AuthorizationActorContext
  readonly session: Session
}

export function sessionAuthenticate(options: SessionAuthenticateOptions): Result<SessionAuthentication> {
  const op = "sessionAuthenticate"
  if (options.realmId.length === 0 || options.token.length === 0)
    return resultErrorCreate(op, "Session authorization is required.", "sessions.unauthorized")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "Session authorization is invalid.", "sessions.invalid")
  const repository = sessionRepositoryCreate(options.database.db)
  const found = repository.sessionGetByTokenHash(sessionCredentialHashCreate(options.token))
  if (!found.success) return found
  if (found.data === null || found.data.realmId !== options.realmId)
    return resultErrorCreate(op, "Session authorization is invalid.", "sessions.invalid")
  if (found.data.revokedAt !== null || found.data.expiresAt <= now)
    return resultErrorCreate(op, "Session authorization is invalid.", "sessions.invalid")
  const user = options.database.db
    .select({ id: userTable.id, state: userTable.state })
    .from(userTable)
    .where(and(eq(userTable.realmId, options.realmId), eq(userTable.id, found.data.userId)))
    .get()
  if (user === undefined || user.state !== "active")
    return resultErrorCreate(op, "Session authorization is invalid.", "sessions.invalid")
  let impersonationPermissions: string[] | undefined
  if (
    found.data.impersonatorId === null &&
    (found.data.impersonationOrganizationId !== null ||
      found.data.impersonationPermissions !== null ||
      found.data.impersonationReason !== null)
  )
    return resultErrorCreate(op, "Session authorization is invalid.", "sessions.invalid")
  if (found.data.impersonatorId !== null) {
    if (found.data.impersonationReason === null || found.data.impersonationPermissions === null)
      return resultErrorCreate(op, "Session authorization is invalid.", "sessions.invalid")
    const permissions = sessionImpersonationPermissionsParse(found.data.impersonationPermissions)
    if (!permissions.success) return resultErrorCreate(op, "Session authorization is invalid.", "sessions.invalid")
    impersonationPermissions = permissions.data
    const impersonator = options.database.db
      .select({ id: userTable.id, state: userTable.state })
      .from(userTable)
      .where(and(eq(userTable.realmId, options.realmId), eq(userTable.id, found.data.impersonatorId)))
      .get()
    const bootstrap = options.database.db
      .select({ id: realmBootstrapAdminTable.adminId })
      .from(realmBootstrapAdminTable)
      .where(
        and(
          eq(realmBootstrapAdminTable.realmId, options.realmId),
          eq(realmBootstrapAdminTable.adminId, found.data.impersonatorId),
        ),
      )
      .get()
    if ((impersonator === undefined || impersonator.state !== "active") && bootstrap === undefined)
      return resultErrorCreate(op, "Session authorization is invalid.", "sessions.invalid")
  }
  const used = repository.sessionLastUsedUpdate(
    options.realmId,
    found.data.id,
    sessionCredentialHashCreate(options.token),
    now,
  )
  if (!used.success || used.data === null)
    return resultErrorCreate(op, "Session authorization is invalid.", "sessions.invalid")
  const actor = authorizationActorContextCreate({
    actorId: found.data.userId,
    assurance: found.data.assurance as AuthorizationActorContext["assurance"],
    authenticationMethod: "trusted",
    realmId: found.data.realmId,
    ...(found.data.impersonationPermissions === null ? {} : { impersonationPermissions }),
    ...(found.data.impersonatorId === null ? {} : { impersonatorId: found.data.impersonatorId }),
    ...(found.data.impersonatorId === null ? {} : { impersonationSessionId: found.data.id }),
    kind: "user",
    ...(found.data.impersonationOrganizationId === null
      ? {}
      : { organizationId: found.data.impersonationOrganizationId }),
  })
  return resultCreate({ actor, session: sessionPublicViewCreate(used.data, true) })
}

function sessionImpersonationPermissionsParse(value: string): Result<string[]> {
  try {
    const parsed = v.safeParse(v.array(authorizationPermissionSchema), JSON.parse(value))
    if (!parsed.success)
      return resultErrorCreate(
        "sessionImpersonationPermissionsParse",
        "The session permissions are invalid.",
        "sessions.forbidden",
      )
    return resultCreate(parsed.output)
  } catch (_error) {
    return resultErrorCreate(
      "sessionImpersonationPermissionsParse",
      "The session permissions are invalid.",
      "sessions.forbidden",
    )
  }
}
