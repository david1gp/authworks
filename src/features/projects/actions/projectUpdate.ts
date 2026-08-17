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
import { projectNameNormalize } from "../domain/projectNameNormalize.js"
import { projectPublicViewCreate } from "../domain/projectPublicViewCreate.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectUpdatedEventPayloadSchema } from "../events/projectUpdatedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import { projectUpdateRequestSchema, type ProjectUpdateRequest } from "../public/projectUpdateRequestSchema.js"
import type { Project } from "../public/projectSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectUpdateOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly input: ProjectUpdateRequest
  readonly instanceId: string
  readonly projectId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectUpdate(options: ProjectUpdateOptions): Result<{ project: Project }> {
  const op = "projectUpdate"
  const parsed = v.safeParse(projectUpdateRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The project update is invalid.")
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
    if (current.data === null || current.data.instanceId !== options.instanceId || current.data.status !== "active")
      return resultErrorCreate(op, "The project was not found.")
    const authorized = projectContextAuthorize({
      context: options.context,
      database: options.database,
      instanceId: options.instanceId,
      permission: "project.write",
      project: current.data,
    })
    if (!authorized.success) return authorized
    const name =
      parsed.output.name === undefined ? resultCreate(current.data.name) : projectNameNormalize(parsed.output.name)
    if (!name.success) return name
    const updated = repository.projectUpdate(options.projectId, {
      authorizationRequired:
        parsed.output.authorizationRequired === undefined
          ? current.data.authorizationRequired
          : parsed.output.authorizationRequired
            ? 1
            : 0,
      name: name.data,
      projectAccessRequired:
        parsed.output.projectAccessRequired === undefined
          ? current.data.projectAccessRequired
          : parsed.output.projectAccessRequired
            ? 1
            : 0,
      updatedAt,
      version: current.data.version + 1,
    })
    if (!updated.success) return resultErrorCreate(op, "A project with that name already exists in this organization.")
    if (updated.data === null) return resultErrorCreate(op, "The project was not found.")
    const payload = v.safeParse(projectUpdatedEventPayloadSchema, {
      authorizationRequired: updated.data.authorizationRequired === 1,
      name: updated.data.name,
      projectAccessRequired: updated.data.projectAccessRequired === 1,
    })
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
        eventType: projectEventTypes.updated,
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
