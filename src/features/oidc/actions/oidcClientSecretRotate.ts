import { type Result } from "#result"
import * as v from "valibot"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { oidcClientContextAuthorize } from "../domain/oidcClientContextAuthorize.js"
import { oidcClientPublicViewCreate } from "../domain/oidcClientPublicViewCreate.js"
import { oidcClientSecretCreate } from "../domain/oidcClientSecretCreate.js"
import { oidcSecretHashCreate } from "../domain/oidcSecretHashCreate.js"
import { oidcClientSecretRotatedEventPayloadSchema } from "../events/oidcClientSecretRotatedEventPayloadSchema.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import { oidcClientSecretRotateResponseSchema } from "../public/oidcClientSecretRotateResponseSchema.js"

type OidcClientSecretRotateOptions = {
  readonly clientId: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function oidcClientSecretRotate(
  options: OidcClientSecretRotateOptions,
): Result<v.InferOutput<typeof oidcClientSecretRotateResponseSchema>> {
  const op = "oidcClientSecretRotate"
  const authorized = oidcClientContextAuthorize({ context: options.context, realmId: options.realmId })
  if (!authorized.success) return authorized
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCreate(op, "The client timestamp is invalid.")
  const secret = oidcClientSecretCreate(runtime)
  if (!secret.success) return secret
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const current = repository.clientGet(options.realmId, options.clientId)
    if (!current.success) return current
    if (current.data === null || current.data.status === "removed")
      return resultErrorCreate(op, "The OIDC client was not found.")
    if (current.data.clientType !== "confidential")
      return resultErrorCreate(op, "Public OIDC clients do not have a client secret.")
    const updated = repository.clientUpdate(options.realmId, options.clientId, {
      secretHash: oidcSecretHashCreate(secret.data),
      updatedAt,
      version: current.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The OIDC client was not found.")
    const payload = v.safeParse(oidcClientSecretRotatedEventPayloadSchema, { clientType: "confidential" })
    if (!payload.success) return resultErrorCreate(op, "The OIDC client event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.clientId,
        aggregateType: "oidc_client",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: oidcEventTypes.clientSecretRotated,
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
    return resultCreate({ client: client.data, clientSecret: secret.data })
  })
}
