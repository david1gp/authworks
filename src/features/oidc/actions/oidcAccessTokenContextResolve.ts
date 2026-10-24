import { and, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { type SessionRow, sessionTable } from "../../sessions/persistence/sessionTable.js"
import { type UserRow, userTable } from "../../users/persistence/userTable.js"
import { oidcHashCreate } from "../domain/oidcHashCreate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import type { OidcAccessTokenRow } from "../persistence/oidcAccessTokenTable.js"
import type { OidcClientRow } from "../persistence/oidcClientTable.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import { oidcScopeSchema } from "../public/oidcScopeSchema.js"
import { oidcClientContextValidate } from "../server/oidcClientContextValidate.js"

type OidcAccessTokenContextResolveOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly token: string
}

export type OidcAccessTokenContext = {
  readonly access: OidcAccessTokenRow
  readonly client: OidcClientRow
  readonly scope: string[]
  readonly session: SessionRow
  readonly user: UserRow
}

export function oidcAccessTokenContextResolve(
  options: OidcAccessTokenContextResolveOptions,
): Result<OidcAccessTokenContext> {
  if (options.realmId.length === 0 || options.token.length === 0)
    return resultErrorCreate("oidcAccessTokenContextInvalidToken", "The access token is invalid.")
  const realm = realmGet({
    context: realmSystemContextCreate(),
    database: options.database,
    realmId: options.realmId,
  })
  if (!realm.success || realm.data.realm.status !== "active")
    return resultErrorCreate("oidcAccessTokenContextInvalidToken", "The access token is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate("oidcAccessTokenContextInvalidToken", "The access token is invalid.")

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
      return resultErrorCreate("oidcAccessTokenContextInvalidToken", "The access token is invalid.")
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
      return resultErrorCreate("oidcAccessTokenContextInvalidToken", "The access token is invalid.")
    const user = transaction
      .select()
      .from(userTable)
      .where(and(eq(userTable.realmId, options.realmId), eq(userTable.id, access.data.userId)))
      .get()
    if (user === undefined || user.state !== "active" || user.deletedAt !== null)
      return resultErrorCreate("oidcAccessTokenContextInvalidToken", "The access token is invalid.")
    const client = repository.clientGet(options.realmId, access.data.clientId)
    if (!client.success) return client
    if (client.data === null || client.data.status !== "active")
      return resultErrorCreate("oidcAccessTokenContextInvalidToken", "The access token is invalid.")
    const clientContext = oidcClientContextValidate({
      applicationId: client.data.applicationId,
      executor: transaction,
      organizationId: session.impersonationOrganizationId ?? session.organizationId,
      projectId: client.data.projectId,
      realmId: options.realmId,
    })
    if (!clientContext.success)
      return resultErrorCreate("oidcAccessTokenContextInvalidToken", "The access token is invalid.")
    const scope = oidcAccessTokenContextScopeParse(access.data.scope)
    if (!scope.success) return resultErrorCreate("oidcAccessTokenContextInvalidToken", "The access token is invalid.")
    return resultCreate({
      access: access.data,
      client: client.data,
      scope: scope.data,
      session,
      user,
    })
  })
}

function oidcAccessTokenContextScopeParse(value: string): Result<string[]> {
  try {
    const parsed = v.safeParse(v.pipe(v.array(oidcScopeSchema), v.minLength(1)), JSON.parse(value))
    if (!parsed.success || new Set(parsed.output).size !== parsed.output.length)
      return resultErrorCreate("oidcAccessTokenContextScopeParse", "The access token scope is invalid.")
    return resultCreate(parsed.output)
  } catch (_error) {
    return resultErrorCreate("oidcAccessTokenContextScopeParse", "The access token scope is invalid.")
  }
}
