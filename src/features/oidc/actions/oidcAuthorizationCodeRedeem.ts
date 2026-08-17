import * as v from "valibot"
import { and, eq } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { oidcClientSecretMatches } from "../domain/oidcClientSecretMatches.js"
import { oidcHashCreate } from "../domain/oidcHashCreate.js"
import { oidcPkceVerify } from "../domain/oidcPkceVerify.js"
import { oidcRedirectUriMatches } from "../domain/oidcRedirectUriMatches.js"
import { oidcScopeSchema } from "../domain/oidcScopeSchema.js"
import { oidcValueDecrypt } from "../domain/oidcValueEncrypt.js"
import { oidcAuthorizationCodeConsumedEventPayloadSchema } from "../events/oidcAuthorizationCodeConsumedEventPayloadSchema.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import { sessionTable } from "../../sessions/persistence/sessionTable.js"
import type { OidcAuthorizationCodeRedeemRequest } from "../public/oidcAuthorizationCodeRedeemRequestSchema.js"
import { oidcAuthorizationCodeRedeemRequestSchema } from "../public/oidcAuthorizationCodeRedeemRequestSchema.js"
import type { OidcAuthorizationCodeRedeemResponse } from "../public/oidcAuthorizationCodeRedeemResponseSchema.js"

type OidcAuthorizationCodeRedeemOptions = {
  readonly database: StorageDatabase
  readonly encryptionSecret?: Secret | string
  readonly input: OidcAuthorizationCodeRedeemRequest
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function oidcAuthorizationCodeRedeem(
  options: OidcAuthorizationCodeRedeemOptions,
): Result<OidcAuthorizationCodeRedeemResponse> {
  const op = "oidcAuthorizationCodeRedeem"
  const parsed = v.safeParse(oidcAuthorizationCodeRedeemRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The authorization code request is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The authorization code timestamp is invalid.")
  const tokenHash = oidcHashCreate(parsed.output.code)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  return storageTransactionRun(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const client = repository.clientGet(options.instanceId, parsed.output.client_id)
    if (!client.success) return client
    if (client.data === null || client.data.status !== "active")
      return resultErrorCreate(op, "The authorization code is invalid.")
    if (client.data.clientType === "confidential") {
      if (
        parsed.output.client_secret === undefined ||
        client.data.secretHash === null ||
        !oidcClientSecretMatches(parsed.output.client_secret, client.data.secretHash)
      )
        return resultErrorCreate(op, "The authorization code is invalid.")
    } else if (parsed.output.client_secret !== undefined) {
      return resultErrorCreate(op, "The authorization code is invalid.")
    }

    const redirectUris = oidcStringArrayParse(client.data.redirectUris)
    if (!redirectUris.success) return resultErrorCreate(op, "The authorization code is invalid.")
    if (!oidcRedirectUriMatches(parsed.output.redirect_uri, redirectUris.data).success)
      return resultErrorCreate(op, "The authorization code is invalid.")

    const code = repository.authorizationCodeGetByTokenHash(options.instanceId, tokenHash)
    if (!code.success) return code
    if (
      code.data === null ||
      code.data.instanceId !== options.instanceId ||
      code.data.clientId !== parsed.output.client_id ||
      code.data.redirectUri !== parsed.output.redirect_uri ||
      code.data.usedAt !== null ||
      code.data.expiresAt <= now
    )
      return resultErrorCreate(op, "The authorization code is invalid.")

    const session = transaction
      .select({ expiresAt: sessionTable.expiresAt, revokedAt: sessionTable.revokedAt })
      .from(sessionTable)
      .where(
        and(
          eq(sessionTable.instanceId, options.instanceId),
          eq(sessionTable.id, code.data.sessionId),
          eq(sessionTable.userId, code.data.userId),
        ),
      )
      .get()
    if (session === undefined || session.revokedAt !== null || session.expiresAt <= now)
      return resultErrorCreate(op, "The authorization code is invalid.")

    const pkce = oidcPkceVerify(parsed.output.code_verifier, code.data.codeChallenge, code.data.codeChallengeMethod)
    if (!pkce.success) return resultErrorCreate(op, "The authorization code is invalid.")

    const scope = oidcScopeParse(code.data.scope)
    if (!scope.success) return resultErrorCreate(op, "The authorization code is invalid.")
    const nonce =
      code.data.nonceEncrypted === null
        ? resultCreate<string | null>(null)
        : oidcValueDecrypt(code.data.nonceEncrypted, options.instanceId, options.encryptionSecret)
    if (!nonce.success) return resultErrorCreate(op, "The authorization code is invalid.")

    const consumed = repository.authorizationCodeConsume(
      options.instanceId,
      parsed.output.client_id,
      code.data.id,
      tokenHash,
      now,
      now,
    )
    if (!consumed.success) return consumed
    if (consumed.data === null) return resultErrorCreate(op, "The authorization code is invalid.")

    const payload = v.safeParse(oidcAuthorizationCodeConsumedEventPayloadSchema, {
      authorizationCodeId: consumed.data.id,
      clientId: consumed.data.clientId,
      nonceProvided: consumed.data.nonceEncrypted !== null,
      redirectUri: consumed.data.redirectUri,
      scope: scope.data,
      sessionId: consumed.data.sessionId,
      userId: consumed.data.userId,
    })
    if (!payload.success) return resultErrorCreate(op, "The authorization code event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: consumed.data.userId,
        aggregateId: consumed.data.id,
        aggregateType: "oidc_authorization_code",
        aggregateVersion: 2,
        commandIndex: 0,
        correlationId,
        eventType: oidcEventTypes.authorizationCodeConsumed,
        instanceId: options.instanceId,
        metadata: { auditSafe: true, source: "oidc" },
        occurredAt: now,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({
      client_id: consumed.data.clientId,
      instance_id: consumed.data.instanceId,
      nonce: nonce.data,
      redirect_uri: consumed.data.redirectUri,
      scope: scope.data,
      session_id: consumed.data.sessionId,
      user_id: consumed.data.userId,
    })
  })
}

function oidcScopeParse(value: string): Result<string[]> {
  try {
    const parsed = v.safeParse(v.pipe(v.array(oidcScopeSchema), v.minLength(1)), JSON.parse(value))
    if (!parsed.success) return resultErrorCreate("oidcScopeParse", "The authorization scope is invalid.")
    return resultCreate(parsed.output)
  } catch (_error) {
    return resultErrorCreate("oidcScopeParse", "The authorization scope is invalid.")
  }
}

function oidcStringArrayParse(value: string): Result<string[]> {
  try {
    const parsed = v.safeParse(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))), JSON.parse(value))
    if (!parsed.success) return resultErrorCreate("oidcStringArrayParse", "The OIDC client configuration is invalid.")
    return resultCreate(parsed.output)
  } catch (_error) {
    return resultErrorCreate("oidcStringArrayParse", "The OIDC client configuration is invalid.")
  }
}
