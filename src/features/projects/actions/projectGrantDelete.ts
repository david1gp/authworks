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
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectGrantDeletedEventPayloadSchema } from "../events/projectGrantDeletedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectGrantDeleteOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly grantId: string
  readonly instanceId: string
  readonly projectId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectGrantDelete(options: ProjectGrantDeleteOptions): Result<{ deleted: boolean; grantId: string }> {
  const op = "projectGrantDelete"
  const runtime = options.runtime ?? options.database.runtime
  const deletedAt = runtime.now()
  if (!Number.isSafeInteger(deletedAt) || deletedAt < 0)
    return resultErrorCreate(op, "The project grant timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = projectRepositoryCreate(transaction)
    const current = repository.projectGrantGet(options.grantId)
    if (!current.success) return current
    if (
      current.data === null ||
      current.data.instanceId !== options.instanceId ||
      current.data.projectId !== options.projectId
    )
      return resultCreate({ deleted: true, grantId: options.grantId })
    const project = repository.projectGet(options.projectId)
    if (!project.success) return project
    if (project.data === null || project.data.status !== "active")
      return resultErrorCreate(op, "The project was not found.")
    const authorized = projectContextAuthorize({
      context: options.context,
      database: options.database,
      instanceId: options.instanceId,
      permission: "project.grant.delete",
      project: project.data,
    })
    if (!authorized.success) return authorized
    const deleted = repository.projectGrantDelete(options.grantId)
    if (!deleted.success) return deleted
    if (deleted.data === null) return resultCreate({ deleted: true, grantId: options.grantId })
    const payload = v.safeParse(projectGrantDeletedEventPayloadSchema, {
      grantedOrganizationId: current.data.grantedOrganizationId,
      grantId: options.grantId,
      projectId: options.projectId,
    })
    if (!payload.success) return resultErrorCreate(op, "The project grant event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.grantId,
        aggregateType: "project_grant",
        aggregateVersion: current.data.version + 1,
        commandIndex: 0,
        correlationId,
        eventType: projectEventTypes.grantDeleted,
        instanceId: options.instanceId,
        metadata: { source: "projects" },
        occurredAt: deletedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ deleted: true, grantId: options.grantId })
  })
}
