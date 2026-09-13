import { and, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { sessionTable } from "../../sessions/persistence/sessionTable.js"
import { userProfileTable } from "../../users/persistence/userProfileTable.js"
import { userTable } from "../../users/persistence/userTable.js"
import { oidcHashCreate } from "../domain/oidcHashCreate.js"
import { oidcResourceOwnerOrganizationIdResolve } from "../domain/oidcResourceOwnerOrganizationIdResolve.js"
import { oidcResourceOwnerScope } from "../domain/oidcResourceOwnerScope.js"
import { oidcUserInfoClaimsCreate } from "../domain/oidcUserInfoClaimsCreate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import { oidcScopeSchema } from "../public/oidcScopeSchema.js"
import type { OidcUserInfo } from "../public/oidcUserInfoSchema.js"
import { oidcClientContextValidate } from "../server/oidcClientContextValidate.js"

type OidcUserInfoGetOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly token: string
}

export function oidcUserInfoGet(options: OidcUserInfoGetOptions): Result<OidcUserInfo> {
  if (options.realmId.length === 0 || options.token.length === 0)
    return resultErrorCreate("oidcUserInfoInvalidToken", "The access token is invalid.")
  const realm = realmGet({
    context: realmSystemContextCreate(),
    database: options.database,
    realmId: options.realmId,
  })
  if (!realm.success || realm.data.realm.status !== "active")
    return resultErrorCreate("oidcUserInfoInvalidToken", "The access token is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate("oidcUserInfoInvalidToken", "The access token is invalid.")

  return storageTransactionRun(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const access = repository.accessTokenGetByTokenHash(options.realmId, oidcHashCreate(options.token))
    if (!access.success) return access
    if (
      access.data === null ||
      access.data.realmId !== options.realmId ||
      access.data.expiresAt <= now ||
      access.data.revokedAt !== null
    )
      return resultErrorCreate("oidcUserInfoInvalidToken", "The access token is invalid.")
    const session = transaction
      .select()
      .from(sessionTable)
      .where(
        and(
          eq(sessionTable.realmId, options.realmId),
          eq(sessionTable.id, access.data.sessionId),
          eq(sessionTable.userId, access.data.userId),
        ),
      )
      .get()
    if (session === undefined || session.revokedAt !== null || session.expiresAt <= now)
      return resultErrorCreate("oidcUserInfoInvalidToken", "The access token is invalid.")
    const user = transaction
      .select()
      .from(userTable)
      .where(and(eq(userTable.realmId, options.realmId), eq(userTable.id, access.data.userId)))
      .get()
    if (user === undefined || user.state !== "active" || user.deletedAt !== null)
      return resultErrorCreate("oidcUserInfoInvalidToken", "The access token is invalid.")
    const client = repository.clientGet(options.realmId, access.data.clientId)
    if (!client.success) return client
    if (client.data === null || client.data.status !== "active")
      return resultErrorCreate("oidcUserInfoInvalidToken", "The access token is invalid.")
    const clientContext = oidcClientContextValidate({
      applicationId: client.data.applicationId,
      executor: transaction,
      organizationId: session.impersonationOrganizationId ?? session.organizationId,
      projectId: client.data.projectId,
      realmId: options.realmId,
    })
    if (!clientContext.success) return resultErrorCreate("oidcUserInfoInvalidToken", "The access token is invalid.")
    const profile =
      transaction
        .select()
        .from(userProfileTable)
        .where(and(eq(userProfileTable.realmId, options.realmId), eq(userProfileTable.userId, user.id)))
        .get() ?? null
    const scope = oidcUserInfoScopeParse(access.data.scope)
    if (!scope.success) return resultErrorCreate("oidcUserInfoInvalidToken", "The access token is invalid.")
    const resourceOwnerOrganizationId = scope.data.includes(oidcResourceOwnerScope)
      ? oidcResourceOwnerOrganizationIdResolve({
          executor: transaction,
          realmId: options.realmId,
          session,
          userId: user.id,
        })
      : resultCreate<string | undefined>(undefined)
    if (!resourceOwnerOrganizationId.success) return resourceOwnerOrganizationId
    return resultCreate(
      oidcUserInfoClaimsCreate(
        { profile, resourceOwnerOrganizationId: resourceOwnerOrganizationId.data, session, user },
        scope.data,
      ),
    )
  })
}

function oidcUserInfoScopeParse(value: string): Result<string[]> {
  try {
    const parsed = v.safeParse(v.pipe(v.array(oidcScopeSchema), v.minLength(1)), JSON.parse(value))
    if (!parsed.success || new Set(parsed.output).size !== parsed.output.length)
      return resultErrorCreate("oidcUserInfoScopeParse", "The access token scope is invalid.")
    return resultCreate(parsed.output)
  } catch (_error) {
    return resultErrorCreate("oidcUserInfoScopeParse", "The access token scope is invalid.")
  }
}
