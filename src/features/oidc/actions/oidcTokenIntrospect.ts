import { and, eq } from "drizzle-orm"
import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { userTable } from "../../users/persistence/userTable.js"
import { realmGet } from "../../realms/actions/realmGet.js"
import { realmSystemContextCreate } from "../../realms/domain/realmSystemContextCreate.js"
import { sessionTable } from "../../sessions/persistence/sessionTable.js"
import { oidcClientSecretMatches } from "../domain/oidcClientSecretMatches.js"
import { oidcClockSkewMs } from "../domain/oidcClockSkewMs.js"
import { oidcHashCreate } from "../domain/oidcHashCreate.js"
import { oidcIssuerCreate } from "../domain/oidcIssuerCreate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcIntrospectionRequest } from "../public/oidcIntrospectionRequestSchema.js"
import { oidcIntrospectionRequestSchema } from "../public/oidcIntrospectionRequestSchema.js"
import type { OidcIntrospectionResponse } from "../public/oidcIntrospectionResponseSchema.js"

type OidcTokenIntrospectOptions = {
  readonly database: StorageDatabase
  readonly input: OidcIntrospectionRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
}

// RFC 7662 token introspection for OIDC-issued tokens. Machine
// client_credentials tokens live in the machine-credential store, not the
// OIDC token tables, so they introspect as inactive; that scoping choice is
// documented rather than bridged.
export function oidcTokenIntrospect(options: OidcTokenIntrospectOptions): Result<OidcIntrospectionResponse> {
  const op = "oidcTokenIntrospect"
  const parsed = v.safeParse(oidcIntrospectionRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCreate("oidcTokenIntrospectInvalidRequest", "The introspection request is invalid.")
  if (options.realmId.length === 0)
    return resultErrorCreate("oidcTokenIntrospectInvalidRequest", "The introspection request is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(
      "oidcTokenIntrospectInvalidRequest",
      "The introspection timestamp is invalid.",
      undefined,
      "oidc.invalid-timestamp",
    )
  const realm = realmGet({
    context: realmSystemContextCreate(),
    database: options.database,
    realmId: options.realmId,
  })
  if (!realm.success) return realm
  if (realm.data.realm.status !== "active") return resultErrorCreate(op, "The realm is not active.")
  const issuer = oidcIssuerCreate(realm.data.realm.domain)
  const repository = oidcRepositoryCreate(options.database.db)
  const clientId = parsed.output.client_id
  if (clientId === undefined)
    return resultErrorCreate("oidcTokenIntrospectInvalidClient", "Client authentication failed.")
  const client = repository.clientGet(options.realmId, clientId)
  if (!client.success) return client
  if (client.data === null || client.data.status !== "active")
    return resultErrorCreate("oidcTokenIntrospectInvalidClient", "Client authentication failed.")
  if (client.data.clientType === "confidential") {
    if (
      parsed.output.client_secret === undefined ||
      client.data.secretHash === null ||
      !oidcClientSecretMatches(parsed.output.client_secret, client.data.secretHash)
    )
      return resultErrorCreate("oidcTokenIntrospectInvalidClient", "Client authentication failed.")
  } else if (parsed.output.client_secret !== undefined) {
    return resultErrorCreate("oidcTokenIntrospectInvalidClient", "Client authentication failed.")
  }
  const tokenHash = oidcHashCreate(parsed.output.token)
  const hint = parsed.output.token_type_hint
  const access =
    hint === "refresh_token" ? resultCreate(null) : repository.accessTokenGetByTokenHash(options.realmId, tokenHash)
  if (!access.success) return access
  const refresh =
    hint === "access_token" ? resultCreate(null) : repository.refreshTokenGetByTokenHash(options.realmId, tokenHash)
  if (!refresh.success) return refresh
  const row =
    access.data !== null
      ? { ...access.data, tokenType: "access_token" as const }
      : refresh.data !== null
        ? { ...refresh.data, tokenType: "refresh_token" as const }
        : null
  if (row === null) return resultCreate({ active: false })
  if (row.realmId !== options.realmId || row.clientId !== client.data.id) return resultCreate({ active: false })
  if (row.revokedAt !== null || row.expiresAt + oidcClockSkewMs <= now) return resultCreate({ active: false })
  const transaction = options.database.db
  const session = transaction
    .select()
    .from(sessionTable)
    .where(
      and(
        eq(sessionTable.realmId, options.realmId),
        eq(sessionTable.id, row.sessionId),
        eq(sessionTable.userId, row.userId),
      ),
    )
    .get()
  if (session === undefined || session.revokedAt !== null || session.expiresAt + oidcClockSkewMs <= now)
    return resultCreate({ active: false })
  const user = transaction
    .select()
    .from(userTable)
    .where(and(eq(userTable.realmId, options.realmId), eq(userTable.id, row.userId)))
    .get()
  if (user === undefined || user.state !== "active" || user.deletedAt !== null) return resultCreate({ active: false })
  let scope = ""
  try {
    const parsedScope = v.safeParse(v.array(v.string()), JSON.parse(row.scope))
    if (parsedScope.success) scope = parsedScope.output.join(" ")
  } catch (_error) {
    scope = ""
  }
  return resultCreate({
    active: true,
    aud: row.clientId,
    client_id: row.clientId,
    exp: Math.floor(row.expiresAt / 1_000),
    iat: Math.floor(row.createdAt / 1_000),
    iss: issuer,
    ...(scope.length === 0 ? {} : { scope }),
    sub: row.userId,
    token_type: row.tokenType,
    username: user.userName,
  })
}
