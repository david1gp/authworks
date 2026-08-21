import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { oidcClientContextAuthorize } from "../domain/oidcClientContextAuthorize.js"
import { oidcClientPublicViewCreate } from "../domain/oidcClientPublicViewCreate.js"
import { oidcClientSecretRevokedEventPayloadSchema } from "../events/oidcClientSecretRevokedEventPayloadSchema.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcClientResponse } from "../public/oidcClientResponseSchema.js"

type OidcClientSecretRevokeOptions = {
  readonly clientId: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function oidcClientSecretRevoke(options: OidcClientSecretRevokeOptions): Result<OidcClientResponse> {
  const op = "oidcClientSecretRevoke"
  const authorized = oidcClientContextAuthorize({ context: options.context, realmId: options.realmId })
  if (!authorized.success) return authorized
  const runtime = options.runtime ?? options.database.runtime
  const revokedAt = runtime.now()
  if (!Number.isSafeInteger(revokedAt) || revokedAt < 0)
    return resultErrorCodedCreate(op, "The client timestamp is invalid.", "oidc.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const current = repository.clientGet(options.realmId, options.clientId)
    if (!current.success) return current
    if (current.data === null || current.data.status === "removed")
      return resultErrorCodedCreate(op, "The OIDC client was not found.", "oidc.not-found")
    if (current.data.clientType !== "confidential")
      return resultErrorCodedCreate(op, "Public OIDC clients do not have a client secret.", "oidc.cannot-change")
    if (current.data.secretHash === null) {
      const client = oidcClientPublicViewCreate(current.data)
      if (!client.success) return client
      return resultCreate({ client: client.data })
    }
    const updated = repository.clientUpdate(options.realmId, options.clientId, {
      secretHash: null,
      updatedAt: revokedAt,
      version: current.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCodedCreate(op, "The OIDC client was not found.", "oidc.not-found")
    const payload = v.safeParse(oidcClientSecretRevokedEventPayloadSchema, { clientType: "confidential" })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The OIDC client event payload is invalid.", "oidc.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.clientId,
        aggregateType: "oidc_client",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: oidcEventTypes.clientSecretRevoked,
        realmId: options.realmId,
        metadata: { source: "oidc" },
        occurredAt: revokedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    const client = oidcClientPublicViewCreate(updated.data)
    if (!client.success) return client
    return resultCreate({ client: client.data })
  })
}
