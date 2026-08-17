import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { instanceDomainNormalize } from "../domain/instanceDomainNormalize.js"
import { instanceNameNormalize } from "../domain/instanceNameNormalize.js"
import { instancePublicViewCreate } from "../domain/instancePublicViewCreate.js"
import type { InstanceSystemContext } from "../domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../domain/instanceTenantContext.js"
import { instanceCreatedEventPayloadSchema } from "../events/instanceCreatedEventPayloadSchema.js"
import { instanceEventTypes } from "../events/instanceEventTypes.js"
import { instanceRepositoryCreate } from "../persistence/instanceRepositoryCreate.js"
import type { InstanceCreateRequest } from "../public/instanceCreateRequestSchema.js"
import type { Instance } from "../public/instanceSchema.js"

type InstanceCreateOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: InstanceCreateRequest
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function instanceCreate(options: InstanceCreateOptions): Result<{ instance: Instance }> {
  const op = "instanceCreate"
  if (options.context?.kind !== "system") return resultErrorCreate(op, "Only the system context can create instances.")

  const name = instanceNameNormalize(options.input.name)
  if (!name.success) return name
  const primaryDomain = instanceDomainNormalize(options.input.domain)
  if (!primaryDomain.success) return primaryDomain
  const domains = [primaryDomain.data]
  for (const candidate of options.input.domains ?? []) {
    const domain = instanceDomainNormalize(candidate)
    if (!domain.success) return domain
    if (domains.includes(domain.data)) return resultErrorCreate(op, "Instance domains must be unique.")
    domains.push(domain.data)
  }

  const runtime = options.runtime ?? options.database.runtime
  const instanceId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCreate(op, "The instance timestamp is invalid.")

  return storageTransactionRun(options.database, (transaction) => {
    const repository = instanceRepositoryCreate(transaction)
    const created = repository.instanceCreate(
      {
        createdAt,
        id: instanceId,
        name: name.data,
        primaryDomain: primaryDomain.data,
        status: "active",
        updatedAt: createdAt,
        version: 1,
      },
      domains,
    )
    if (!created.success) {
      if (created.errorMessage === "The instance could not be created.")
        return resultErrorCreate(op, "An instance with that domain already exists.")
      return created
    }

    const payloadResult = v.safeParse(instanceCreatedEventPayloadSchema, {
      domain: primaryDomain.data,
      name: name.data,
    })
    if (!payloadResult.success) return resultErrorCreate(op, "The instance event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: instanceId,
        aggregateType: "instance",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: instanceEventTypes.created,
        instanceId,
        metadata: { source: "instances" },
        occurredAt: createdAt,
        payload: payloadResult.output,
      },
      runtime,
    )
    if (!event.success) return event

    return resultCreate({ instance: instancePublicViewCreate(created.data, domains) })
  })
}
