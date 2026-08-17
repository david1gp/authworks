import { type Result } from "#result"
import * as v from "valibot"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { instanceGet } from "../../instances/actions/instanceGet.js"
import { oidcClientContextAuthorize } from "../domain/oidcClientContextAuthorize.js"
import { oidcKeyMaterialCreate } from "../domain/oidcKeyMaterialCreate.js"
import { oidcSigningKeyPublicViewCreate } from "../domain/oidcSigningKeyPublicViewCreate.js"
import { oidcValueEncrypt } from "../domain/oidcValueEncrypt.js"
import { oidcEventTypes } from "../events/oidcEventTypes.js"
import { oidcSigningKeyCreatedEventPayloadSchema } from "../events/oidcSigningKeyCreatedEventPayloadSchema.js"
import { oidcSigningKeyRetiredEventPayloadSchema } from "../events/oidcSigningKeyRetiredEventPayloadSchema.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcSigningKeyResponse } from "../public/oidcSigningKeyResponseSchema.js"

type OidcSigningKeyCreateOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly encryptionSecret?: Secret | string
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function oidcSigningKeyCreate(options: OidcSigningKeyCreateOptions): Result<OidcSigningKeyResponse> {
  const op = "oidcSigningKeyCreate"
  const authorized = oidcClientContextAuthorize({ context: options.context, instanceId: options.instanceId })
  if (!authorized.success) return authorized
  const instance = instanceGet({
    context: { actor: options.context.actor, actorId: options.context.actorId, kind: "system" },
    database: options.database,
    instanceId: options.instanceId,
  })
  if (!instance.success) return instance
  if (instance.data.instance.status !== "active") return resultErrorCreate(op, "The instance is not active.")
  const runtime = options.runtime ?? options.database.runtime
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCreate(op, "The signing key timestamp is invalid.")
  const keyId = uuidv7Create(runtime)
  const material = oidcKeyMaterialCreate()
  if (!material.success) return material
  const encrypted = oidcValueEncrypt(material.data.privateKey, options.instanceId, options.encryptionSecret)
  if (!encrypted.success) return encrypted
  const publicJwk = { ...material.data.publicJwk, kid: keyId }
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const existing = repository.signingKeyList(options.instanceId)
    if (!existing.success) return existing
    let commandIndex = 0
    for (const key of existing.data.filter((candidate) => candidate.status === "active")) {
      const retired = repository.signingKeyUpdate(options.instanceId, key.id, {
        retiredAt: createdAt,
        status: "retired",
      })
      if (!retired.success) return retired
      if (retired.data === null) return resultErrorCreate(op, "The active signing key was not found.")
      const retiredPayload = v.safeParse(oidcSigningKeyRetiredEventPayloadSchema, { status: "retired" })
      if (!retiredPayload.success) return resultErrorCreate(op, "The signing key event payload is invalid.")
      const retiredEvent = storageEventAppend(
        transaction,
        {
          actorId: options.context.actorId,
          aggregateId: key.id,
          aggregateType: "oidc_signing_key",
          aggregateVersion: 2,
          commandIndex,
          correlationId,
          eventType: oidcEventTypes.signingKeyRetired,
          instanceId: options.instanceId,
          metadata: { source: "oidc", reason: "rotation" },
          occurredAt: createdAt,
          payload: retiredPayload.output,
        },
        runtime,
      )
      if (!retiredEvent.success) return retiredEvent
      commandIndex += 1
    }
    const created = repository.signingKeyCreate({
      algorithm: "RS256",
      createdAt,
      encryptedPrivateKey: encrypted.data,
      id: keyId,
      instanceId: options.instanceId,
      publicJwk: JSON.stringify(publicJwk),
      retiredAt: null,
      status: "active",
    })
    if (!created.success) return created
    const payload = v.safeParse(oidcSigningKeyCreatedEventPayloadSchema, { algorithm: "RS256" })
    if (!payload.success) return resultErrorCreate(op, "The signing key event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: keyId,
        aggregateType: "oidc_signing_key",
        aggregateVersion: 1,
        commandIndex,
        correlationId,
        eventType: oidcEventTypes.signingKeyCreated,
        instanceId: options.instanceId,
        metadata: { source: "oidc" },
        occurredAt: createdAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    const signingKey = oidcSigningKeyPublicViewCreate(created.data)
    if (!signingKey.success) return signingKey
    return resultCreate({ signingKey: signingKey.data })
  })
}
