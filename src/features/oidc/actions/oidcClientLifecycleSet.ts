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
import { oidcClientStatusChangedEventPayloadSchema } from "../events/oidcClientStatusChangedEventPayloadSchema.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import {
  type OidcClientLifecycleRequest,
  oidcClientLifecycleRequestSchema,
} from "../public/oidcClientLifecycleRequestSchema.js"
import type { OidcClientResponse } from "../public/oidcClientResponseSchema.js"

type OidcClientLifecycleSetOptions = {
  readonly clientId: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: OidcClientLifecycleRequest
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function oidcClientLifecycleSet(options: OidcClientLifecycleSetOptions): Result<OidcClientResponse> {
  const op = "oidcClientLifecycleSet"
  const parsed = v.safeParse(oidcClientLifecycleRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCodedCreate(op, "The OIDC client lifecycle request is invalid.", "oidc.invalid")
  const authorized = oidcClientContextAuthorize({ context: options.context, realmId: options.realmId })
  if (!authorized.success) return authorized
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCodedCreate(op, "The client timestamp is invalid.", "oidc.invalid-timestamp")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const current = repository.clientGet(options.realmId, options.clientId)
    if (!current.success) return current
    if (current.data === null) return resultErrorCodedCreate(op, "The OIDC client was not found.", "oidc.not-found")
    if (current.data.status === "removed")
      return resultErrorCodedCreate(op, "The OIDC client has been removed.", "oidc.removed")
    if (current.data.status === parsed.output.status)
      return resultErrorCodedCreate(op, "The OIDC client already has that status.", "oidc.conflict")
    const updated = repository.clientUpdate(options.realmId, options.clientId, {
      status: parsed.output.status,
      updatedAt,
      version: current.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCodedCreate(op, "The OIDC client was not found.", "oidc.not-found")
    const payload = v.safeParse(oidcClientStatusChangedEventPayloadSchema, { status: updated.data.status })
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
        eventType: oidcEventTypes.clientStatusChanged,
        realmId: options.realmId,
        metadata: { source: "oidc" },
        occurredAt: updatedAt,
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
