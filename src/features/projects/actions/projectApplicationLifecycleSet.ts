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
import { projectApplicationPublicViewCreate } from "../domain/projectApplicationPublicViewCreate.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectApplicationStatusChangedEventPayloadSchema } from "../events/projectApplicationStatusChangedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import {
  projectApplicationLifecycleRequestSchema,
  type ProjectApplicationLifecycleRequest,
} from "../public/projectApplicationLifecycleRequestSchema.js"
import type { ProjectApplication } from "../public/projectApplicationSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectApplicationLifecycleSetOptions = {
  readonly applicationId: string
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: ProjectApplicationLifecycleRequest
  readonly instanceId: string
  readonly projectId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectApplicationLifecycleSet(
  options: ProjectApplicationLifecycleSetOptions,
): Result<{ application: ProjectApplication }> {
  const op = "projectApplicationLifecycleSet"
  const parsed = v.safeParse(projectApplicationLifecycleRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The application lifecycle request is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCreate(op, "The application timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = projectRepositoryCreate(transaction)
    const current = repository.projectApplicationGet(options.applicationId)
    if (!current.success) return current
    if (
      current.data === null ||
      current.data.instanceId !== options.instanceId ||
      current.data.projectId !== options.projectId
    )
      return resultErrorCreate(op, "The application was not found.")
    if (current.data.status === "removed") return resultErrorCreate(op, "The application has been removed.")
    if (current.data.status === parsed.output.status)
      return resultErrorCreate(op, "The application already has that status.")
    const project = repository.projectGet(options.projectId)
    if (!project.success) return project
    if (project.data === null || project.data.status !== "active")
      return resultErrorCreate(op, "The project was not found.")
    const authorized = projectContextAuthorize({
      context: options.context,
      database: options.database,
      instanceId: options.instanceId,
      permission: "project.app.write",
      project: project.data,
    })
    if (!authorized.success) return authorized
    const updated = repository.projectApplicationUpdate(options.applicationId, {
      status: parsed.output.status,
      updatedAt,
      version: current.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The application was not found.")
    const payload = v.safeParse(projectApplicationStatusChangedEventPayloadSchema, {
      applicationId: options.applicationId,
      status: updated.data.status,
    })
    if (!payload.success) return resultErrorCreate(op, "The application event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.applicationId,
        aggregateType: "project_application",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: projectEventTypes.applicationStatusChanged,
        instanceId: options.instanceId,
        metadata: { source: "projects" },
        occurredAt: updatedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ application: projectApplicationPublicViewCreate(updated.data) })
  })
}
