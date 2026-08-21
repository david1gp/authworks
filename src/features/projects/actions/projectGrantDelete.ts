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
import { projectGrantDeletedEventPayloadSchema } from "../events/projectGrantDeletedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectGrantDeleteOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly grantId: string
  readonly realmId: string
  readonly projectId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectGrantDelete(options: ProjectGrantDeleteOptions): Result<{ deleted: boolean; grantId: string }> {
  const op = "projectGrantDelete"
  const runtime = options.runtime ?? options.database.runtime
  const deletedAt = runtime.now()
  if (!Number.isSafeInteger(deletedAt) || deletedAt < 0)
    return resultErrorCodedCreate(op, "The project grant timestamp is invalid.", "projects.timestamp-invalid")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = projectRepositoryCreate(transaction)
    const current = repository.projectGrantGet(options.grantId)
    if (!current.success) return current
    if (
      current.data === null ||
      current.data.realmId !== options.realmId ||
      current.data.projectId !== options.projectId
    )
      return resultCreate({ deleted: true, grantId: options.grantId })
    const project = repository.projectGet(options.projectId)
    if (!project.success) return project
    if (project.data === null || project.data.status !== "active")
      return resultErrorCodedCreate(op, "The project was not found.", "projects.not-found")
    const authorized = projectContextAuthorize({
      context: options.context,
      database: options.database,
      realmId: options.realmId,
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
    if (!payload.success)
      return resultErrorCodedCreate(op, "The project grant event payload is invalid.", "projects.event-invalid")
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
        realmId: options.realmId,
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
