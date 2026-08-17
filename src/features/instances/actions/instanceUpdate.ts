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
import { instanceEventTypes } from "../events/instanceEventTypes.js"
import { instanceUpdatedEventPayloadSchema } from "../events/instanceUpdatedEventPayloadSchema.js"
import { instanceRepositoryCreate } from "../persistence/instanceRepositoryCreate.js"
import type { Instance } from "../public/instanceSchema.js"
import { type InstanceUpdateRequest, instanceUpdateRequestSchema } from "../public/instanceUpdateRequestSchema.js"

type InstanceUpdateOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: InstanceUpdateRequest
  readonly instanceId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function instanceUpdate(options: InstanceUpdateOptions): Result<{ instance: Instance }> {
  const op = "instanceUpdate"
  if (options.context === undefined || options.context === null)
    return resultErrorCreate(op, "A tenant context is required.")
  if (options.context.kind === "tenant" && options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The instance is not available in this tenant context.")

  const parsed = v.safeParse(instanceUpdateRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The instance update is invalid.")
  if (Object.keys(parsed.output).length === 0) return resultErrorCreate(op, "The instance update is empty.")

  const runtime = options.runtime ?? options.database.runtime
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCreate(op, "The instance timestamp is invalid.")

  return storageTransactionRun(options.database, (transaction) => {
    const repository = instanceRepositoryCreate(transaction)
    const current = repository.instanceGet(options.instanceId)
    if (!current.success) return current
    if (current.data === null) return resultErrorCreate(op, "The instance was not found.")
    const currentRow = current.data
    const currentDomains = repository.instanceDomainList(options.instanceId)
    if (!currentDomains.success) return currentDomains

    const name =
      parsed.output.name === undefined ? resultCreate(currentRow.name) : instanceNameNormalize(parsed.output.name)
    if (!name.success) return name
    const primaryDomain =
      parsed.output.domain === undefined
        ? resultCreate(currentRow.primaryDomain)
        : instanceDomainNormalize(parsed.output.domain)
    if (!primaryDomain.success) return primaryDomain

    let domains = currentDomains.data
    if (parsed.output.domains !== undefined) {
      domains = [primaryDomain.data]
      for (const candidate of parsed.output.domains) {
        const domain = instanceDomainNormalize(candidate)
        if (!domain.success) return domain
        if (domains.includes(domain.data)) return resultErrorCreate(op, "Instance domains must be unique.")
        domains.push(domain.data)
      }
    } else if (parsed.output.domain !== undefined) {
      domains = [primaryDomain.data, ...currentDomains.data.filter((domain) => domain !== currentRow.primaryDomain)]
      if (new Set(domains).size !== domains.length) return resultErrorCreate(op, "Instance domains must be unique.")
    }

    const version = currentRow.version + 1
    const updated = repository.instanceUpdate(options.instanceId, {
      name: name.data,
      primaryDomain: primaryDomain.data,
      status: parsed.output.status ?? current.data.status,
      updatedAt,
      version,
    })
    if (!updated.success) {
      if (updated.errorMessage === "The instance could not be updated.")
        return resultErrorCreate(op, "An instance with that domain already exists.")
      return updated
    }
    if (updated.data === null) return resultErrorCreate(op, "The instance was not found.")

    const domainUpdate = repository.instanceDomainReplace(options.instanceId, domains)
    if (!domainUpdate.success) {
      if (domainUpdate.errorMessage === "The instance domains could not be updated.")
        return resultErrorCreate(op, "An instance with that domain already exists.")
      return domainUpdate
    }

    const payloadResult = v.safeParse(instanceUpdatedEventPayloadSchema, {
      domain: primaryDomain.data,
      name: name.data,
      status: updated.data.status,
    })
    if (!payloadResult.success) return resultErrorCreate(op, "The instance event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.instanceId,
        aggregateType: "instance",
        aggregateVersion: version,
        commandIndex: 0,
        correlationId,
        eventType: instanceEventTypes.updated,
        instanceId: options.instanceId,
        metadata: { source: "instances" },
        occurredAt: updatedAt,
        payload: payloadResult.output,
      },
      runtime,
    )
    if (!event.success) return event

    return resultCreate({ instance: instancePublicViewCreate(updated.data, domains) })
  })
}
