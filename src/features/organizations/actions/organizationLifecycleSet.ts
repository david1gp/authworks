import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { organizationPublicViewCreate } from "../domain/organizationPublicViewCreate.js"
import { organizationEventTypes } from "../events/organizationEventTypes.js"
import { organizationStatusChangedEventPayloadSchema } from "../events/organizationStatusChangedEventPayloadSchema.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import {
  type OrganizationLifecycleRequest,
  organizationLifecycleRequestSchema,
} from "../public/organizationLifecycleRequestSchema.js"
import type { Organization } from "../public/organizationSchema.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationLifecycleSetOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: OrganizationLifecycleRequest
  readonly instanceId: string
  readonly organizationId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function organizationLifecycleSet(
  options: OrganizationLifecycleSetOptions,
): Result<{ organization: Organization }> {
  const op = "organizationLifecycleSet"
  const parsed = v.safeParse(organizationLifecycleRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The organization lifecycle request is invalid.")
  if (options.context.kind === "tenant" && options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The organization is not available in this tenant context.")
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCreate(op, "The organization timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = organizationRepositoryCreate(transaction)
    const current = repository.organizationGet(options.organizationId)
    if (!current.success) return current
    if (current.data === null || current.data.instanceId !== options.instanceId)
      return resultErrorCreate(op, "The organization was not found.")
    if (current.data.status === "removed") return resultErrorCreate(op, "The organization has been removed.")
    if (current.data.status === parsed.output.status)
      return resultErrorCreate(op, "The organization already has that status.")
    if (options.context.kind === "tenant") {
      const authorized = organizationContextAuthorize({
        context: options.context,
        organization: current.data,
        repository,
        requiredRole: "admin",
      })
      if (!authorized.success) return authorized
    }
    const updated = repository.organizationUpdate(options.organizationId, {
      status: parsed.output.status,
      updatedAt,
      version: current.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The organization was not found.")
    const payload = v.safeParse(organizationStatusChangedEventPayloadSchema, { status: updated.data.status })
    if (!payload.success) return resultErrorCreate(op, "The organization event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.organizationId,
        aggregateType: "organization",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: organizationEventTypes.statusChanged,
        instanceId: options.instanceId,
        metadata: { source: "organizations" },
        occurredAt: updatedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ organization: organizationPublicViewCreate(updated.data) })
  })
}
