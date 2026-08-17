import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { Secret } from "../../../platform/secrets/Secret.js"
import { secretGenerate } from "../../../platform/secrets/secretGenerate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { instancePublicViewCreate } from "../domain/instancePublicViewCreate.js"
import { instanceSecretHashCreate } from "../domain/instanceSecretHashCreate.js"
import type { InstanceSystemContext } from "../domain/instanceSystemContext.js"
import { instanceBootstrapAdminCreatedEventPayloadSchema } from "../events/instanceBootstrapAdminCreatedEventPayloadSchema.js"
import { instanceEventTypes } from "../events/instanceEventTypes.js"
import { instanceRepositoryCreate } from "../persistence/instanceRepositoryCreate.js"
import type { Instance } from "../public/instanceSchema.js"

type InstanceBootstrapAdminCreateOptions = {
  readonly context: InstanceSystemContext
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function instanceBootstrapAdminCreate(
  options: InstanceBootstrapAdminCreateOptions,
): Result<{ bootstrapAdmin: { adminId: string; secret: Secret }; instance: Instance }> {
  const op = "instanceBootstrapAdminCreate"
  if (options.context?.kind !== "system")
    return resultErrorCreate(op, "Only the system context can create the bootstrap administrator.")

  const runtime = options.runtime ?? options.database.runtime
  const secret = secretGenerate(32, runtime)
  const adminId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCreate(op, "The bootstrap timestamp is invalid.")

  return storageTransactionRun(options.database, (transaction) => {
    const repository = instanceRepositoryCreate(transaction)
    const current = repository.instanceGet(options.instanceId)
    if (!current.success) return current
    if (current.data === null) return resultErrorCreate(op, "The instance was not found.")
    const existing = repository.instanceBootstrapAdminGet(options.instanceId)
    if (!existing.success) return existing
    if (existing.data !== null) return resultErrorCreate(op, "The bootstrap administrator already exists.")

    const admin = repository.instanceBootstrapAdminCreate({
      adminId,
      createdAt,
      instanceId: options.instanceId,
      secretHash: instanceSecretHashCreate(secret.valueGet()),
    })
    if (!admin.success) return admin
    const version = current.data.version + 1
    const updated = repository.instanceUpdate(options.instanceId, {
      bootstrapAdminId: adminId,
      bootstrapCompletedAt: createdAt,
      updatedAt: createdAt,
      version,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The instance was not found.")

    const payloadResult = v.safeParse(instanceBootstrapAdminCreatedEventPayloadSchema, { adminId })
    if (!payloadResult.success) return resultErrorCreate(op, "The bootstrap event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.instanceId,
        aggregateType: "instance",
        aggregateVersion: version,
        commandIndex: 0,
        correlationId,
        eventType: instanceEventTypes.bootstrapAdminCreated,
        instanceId: options.instanceId,
        metadata: { source: "instances" },
        occurredAt: createdAt,
        payload: payloadResult.output,
      },
      runtime,
    )
    if (!event.success) return event
    const domains = repository.instanceDomainList(options.instanceId)
    if (!domains.success) return domains

    return resultCreate({
      bootstrapAdmin: { adminId, secret },
      instance: instancePublicViewCreate(updated.data, domains.data),
    })
  })
}
