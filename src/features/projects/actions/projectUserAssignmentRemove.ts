import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectUserAssignmentRemovedEventPayloadSchema } from "../events/projectUserAssignmentRemovedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectUserAssignmentRemoveOptions = {
  readonly assignmentId: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly projectId: string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectUserAssignmentRemove(options: ProjectUserAssignmentRemoveOptions): Result<{ removed: true }> {
  const op = "projectUserAssignmentRemove"
  const runtime = options.runtime ?? options.database.runtime
  const removedAt = runtime.now()
  if (!Number.isSafeInteger(removedAt) || removedAt < 0)
    return resultErrorCodedCreate(op, "The project user assignment timestamp is invalid.", "projects.timestamp-invalid")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = projectRepositoryCreate(transaction)
    const current = repository.projectUserAssignmentGet(options.assignmentId)
    if (!current.success) return current
    if (
      current.data === null ||
      current.data.realmId !== options.realmId ||
      current.data.projectId !== options.projectId
    )
      return resultCreate({ removed: true as const })
    const project = repository.projectGet(options.projectId)
    if (!project.success) return project
    if (project.data === null || project.data.realmId !== options.realmId || project.data.status !== "active")
      return resultErrorCodedCreate(op, "The project was not found.", "projects.not-found")
    const authorized = projectContextAuthorize({
      context: options.context,
      database: options.database,
      realmId: options.realmId,
      permission: "project.write",
      project: project.data,
    })
    if (!authorized.success) return authorized
    const removed = repository.projectUserAssignmentDelete(options.assignmentId)
    if (!removed.success) return removed
    if (removed.data === null) return resultCreate({ removed: true as const })
    const payload = v.safeParse(projectUserAssignmentRemovedEventPayloadSchema, {
      assignmentId: options.assignmentId,
      projectId: options.projectId,
      userId: current.data.userId,
    })
    if (!payload.success)
      return resultErrorCodedCreate(
        op,
        "The project user assignment event payload is invalid.",
        "projects.event-invalid",
      )
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.assignmentId,
        aggregateType: "project_user_assignment",
        aggregateVersion: current.data.version + 1,
        commandIndex: 0,
        correlationId,
        eventType: projectEventTypes.userAssignmentRemoved,
        realmId: options.realmId,
        metadata: { source: "projects" },
        occurredAt: removedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ removed: true as const })
  })
}
