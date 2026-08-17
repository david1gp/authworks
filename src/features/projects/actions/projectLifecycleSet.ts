import { type Result } from "#result"
import * as v from "valibot"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { projectPublicViewCreate } from "../domain/projectPublicViewCreate.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectStatusChangedEventPayloadSchema } from "../events/projectStatusChangedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import { projectLifecycleRequestSchema, type ProjectLifecycleRequest } from "../public/projectLifecycleRequestSchema.js"
import type { Project } from "../public/projectSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectLifecycleSetOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: ProjectLifecycleRequest
  readonly instanceId: string
  readonly projectId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectLifecycleSet(options: ProjectLifecycleSetOptions): Result<{ project: Project }> {
  const op = "projectLifecycleSet"
  const parsed = v.safeParse(projectLifecycleRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The project lifecycle request is invalid.")
  if (options.context.kind === "tenant" && options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The project is not available in this tenant context.")
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCreate(op, "The project timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = projectRepositoryCreate(transaction)
    const current = repository.projectGet(options.projectId)
    if (!current.success) return current
    if (current.data === null || current.data.instanceId !== options.instanceId)
      return resultErrorCreate(op, "The project was not found.")
    if (current.data.status === "removed") return resultErrorCreate(op, "The project has been removed.")
    if (current.data.status === parsed.output.status)
      return resultErrorCreate(op, "The project already has that status.")
    const authorized = projectContextAuthorize({
      context: options.context,
      database: options.database,
      instanceId: options.instanceId,
      permission: "project.write",
      project: current.data,
    })
    if (!authorized.success) return authorized
    const updated = repository.projectUpdate(options.projectId, {
      status: parsed.output.status,
      updatedAt,
      version: current.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The project was not found.")
    const payload = v.safeParse(projectStatusChangedEventPayloadSchema, { status: updated.data.status })
    if (!payload.success) return resultErrorCreate(op, "The project event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.projectId,
        aggregateType: "project",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: projectEventTypes.statusChanged,
        instanceId: options.instanceId,
        metadata: { source: "projects" },
        occurredAt: updatedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ project: projectPublicViewCreate(updated.data) })
  })
}
