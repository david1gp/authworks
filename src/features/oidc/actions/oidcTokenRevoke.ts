import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { machineClientCredentialsRevoke } from "../../machineUsers/actions/machineClientCredentialsRevoke.js"
import { oidcClientSecretMatches } from "../domain/oidcClientSecretMatches.js"
import { oidcHashCreate } from "../domain/oidcHashCreate.js"
import { oidcErrorCreate as resultErrorCreate } from "../errors/oidcErrorCreate.js"
import { oidcAccessTokenRevokedEventPayloadSchema } from "../events/oidcAccessTokenRevokedEventPayloadSchema.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcRefreshTokenFamilyRevokedEventPayloadSchema } from "../events/oidcRefreshTokenFamilyRevokedEventPayloadSchema.js"
import type { OidcClientRow } from "../persistence/oidcClientTable.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcTokenRevokeRequest } from "../public/oidcTokenRevokeRequestSchema.js"
import { oidcTokenRevokeRequestSchema } from "../public/oidcTokenRevokeRequestSchema.js"

type OidcTokenRevokeOptions = {
  readonly database: StorageDatabase
  readonly input: OidcTokenRevokeRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function oidcTokenRevoke(options: OidcTokenRevokeOptions): Result<void> {
  const op = "oidcTokenRevoke"
  const parsed = v.safeParse(oidcTokenRevokeRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The token revocation request is invalid.")
  if (options.realmId.length === 0 || parsed.output.client_id === undefined)
    return resultErrorCreate("oidcTokenRevokeInvalidClient", "Client authentication failed.")
  const clientId = parsed.output.client_id
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCreate(op, "The token revocation timestamp is invalid.", undefined, "oidc.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)

  if (clientId !== undefined && !oidcClientIdIsUuid(clientId)) {
    if (parsed.output.client_secret === undefined)
      return resultErrorCreate("oidcTokenRevokeInvalidClient", "Client authentication failed.")
    return machineClientCredentialsRevoke({
      clientId,
      clientSecret: parsed.output.client_secret,
      database: options.database,
      realmId: options.realmId,
      runtime,
      token: parsed.output.token,
    })
  }

  return storageTransactionRun(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const client = repository.clientGet(options.realmId, clientId)
    if (!client.success) return client
    const authenticated = oidcTokenRevokeClientAuthenticate(client.data, parsed.output.client_secret)
    if (!authenticated.success) return authenticated
    const tokenHash = oidcHashCreate(parsed.output.token)
    const access = repository.accessTokenGetByTokenHash(options.realmId, tokenHash)
    if (!access.success) return access
    const refresh = repository.refreshTokenGetByTokenHash(options.realmId, tokenHash)
    if (!refresh.success) return refresh
    const accessTarget = parsed.output.token_type_hint === "refresh_token" && refresh.data !== null ? null : access.data
    if (accessTarget !== null) {
      if (accessTarget.clientId !== authenticated.data.id) return resultCreate(undefined)
      const revoked = repository.accessTokenRevoke(options.realmId, authenticated.data.id, tokenHash, now)
      if (!revoked.success) return revoked
      if (revoked.data === null) return resultCreate(undefined)
      const payload = v.safeParse(oidcAccessTokenRevokedEventPayloadSchema, {
        clientId: revoked.data.clientId,
        sessionId: revoked.data.sessionId,
        userId: revoked.data.userId,
      })
      if (!payload.success) return resultErrorCreate(op, "The token revocation event payload is invalid.")
      const event = storageEventAppend(
        transaction,
        {
          actorId: revoked.data.userId,
          aggregateId: revoked.data.id,
          aggregateType: "oidc_access_token",
          aggregateVersion: 2,
          commandIndex: 0,
          correlationId,
          eventType: oidcEventTypes.accessTokenRevoked,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "oidc" },
          occurredAt: now,
          payload: payload.output,
        },
        runtime,
      )
      if (!event.success) return event
      return resultCreate(undefined)
    }

    if (refresh.data === null || refresh.data.clientId !== authenticated.data.id) return resultCreate(undefined)

    const refreshRevoked = repository.refreshTokenFamilyRevoke(
      options.realmId,
      authenticated.data.id,
      refresh.data.familyId,
      now,
    )
    if (!refreshRevoked.success) return refreshRevoked
    const accessRevoked = repository.accessTokenFamilyRevoke(
      options.realmId,
      authenticated.data.id,
      refresh.data.familyId,
      now,
    )
    if (!accessRevoked.success) return accessRevoked
    if (refreshRevoked.data.length === 0 && accessRevoked.data.length === 0) return resultCreate(undefined)

    let commandIndex = 0
    for (const revoked of accessRevoked.data) {
      const payload = v.safeParse(oidcAccessTokenRevokedEventPayloadSchema, {
        clientId: revoked.clientId,
        sessionId: revoked.sessionId,
        userId: revoked.userId,
      })
      if (!payload.success) return resultErrorCreate(op, "The token revocation event payload is invalid.")
      const event = storageEventAppend(
        transaction,
        {
          actorId: revoked.userId,
          aggregateId: revoked.id,
          aggregateType: "oidc_access_token",
          aggregateVersion: 2,
          commandIndex,
          correlationId,
          eventType: oidcEventTypes.accessTokenRevoked,
          realmId: options.realmId,
          metadata: { auditSafe: true, source: "oidc" },
          occurredAt: now,
          payload: payload.output,
        },
        runtime,
      )
      if (!event.success) return event
      commandIndex += 1
    }

    const familyPayload = v.safeParse(oidcRefreshTokenFamilyRevokedEventPayloadSchema, {
      clientId: refresh.data.clientId,
      familyId: refresh.data.familyId,
      sessionId: refresh.data.sessionId,
      userId: refresh.data.userId,
    })
    if (!familyPayload.success) return resultErrorCreate(op, "The token revocation event payload is invalid.")
    const familyEvent = storageEventAppend(
      transaction,
      {
        actorId: refresh.data.userId,
        aggregateId: refresh.data.familyId,
        aggregateType: "oidc_refresh_token_family",
        aggregateVersion: 1,
        commandIndex,
        correlationId,
        eventType: oidcEventTypes.refreshTokenFamilyRevoked,
        realmId: options.realmId,
        metadata: { auditSafe: true, source: "oidc" },
        occurredAt: now,
        payload: familyPayload.output,
      },
      runtime,
    )
    if (!familyEvent.success) return familyEvent
    return resultCreate(undefined)
  })
}

function oidcClientIdIsUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
}

function oidcTokenRevokeClientAuthenticate(
  client: OidcClientRow | null,
  secret: string | undefined,
): Result<{ readonly id: string }> {
  if (client === null) return resultErrorCreate("oidcTokenRevokeInvalidClient", "Client authentication failed.")
  if (client.status !== "active")
    return resultErrorCreate("oidcTokenRevokeInvalidClient", "Client authentication failed.")
  if (client.clientType === "confidential") {
    if (secret === undefined || client.secretHash === null || !oidcClientSecretMatches(secret, client.secretHash))
      return resultErrorCreate("oidcTokenRevokeInvalidClient", "Client authentication failed.")
    return resultCreate({ id: client.id })
  }
  if (secret !== undefined) return resultErrorCreate("oidcTokenRevokeInvalidClient", "Client authentication failed.")
  return resultCreate({ id: client.id })
}
