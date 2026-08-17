import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
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

type SessionAuthenticateOptions = {
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly token: string
}

type SessionAuthentication = {
  readonly actor: AuthorizationActorContext
  readonly session: Session
}

export function sessionAuthenticate(options: SessionAuthenticateOptions): Result<SessionAuthentication> {
  const op = "sessionAuthenticate"
  if (options.instanceId.length === 0 || options.token.length === 0)
    return resultErrorCreate(op, "Session authorization is required.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0) return resultErrorCreate(op, "Session authorization is invalid.")
  const repository = sessionRepositoryCreate(options.database.db)
  const found = repository.sessionGetByTokenHash(sessionCredentialHashCreate(options.token))
  if (!found.success) return found
  if (found.data === null || found.data.instanceId !== options.instanceId)
    return resultErrorCreate(op, "Session authorization is invalid.")
  if (found.data.revokedAt !== null || found.data.expiresAt <= now)
    return resultErrorCreate(op, "Session authorization is invalid.")
  const user = options.database.db
    .select({ id: userTable.id, state: userTable.state })
    .from(userTable)
    .where(and(eq(userTable.instanceId, options.instanceId), eq(userTable.id, found.data.userId)))
    .get()
  if (user === undefined || user.state !== "active") return resultErrorCreate(op, "Session authorization is invalid.")
  const used = repository.sessionLastUsedUpdate(
    options.instanceId,
    found.data.id,
    sessionCredentialHashCreate(options.token),
    now,
  )
  if (!used.success || used.data === null) return resultErrorCreate(op, "Session authorization is invalid.")
  const actor = authorizationActorContextCreate({
    actorId: found.data.userId,
    assurance: found.data.assurance as AuthorizationActorContext["assurance"],
    authenticationMethod: "trusted",
    instanceId: found.data.instanceId,
    kind: "user",
  })
  return resultCreate({ actor, session: sessionPublicViewCreate(used.data, true) })
}
