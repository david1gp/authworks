import { type Result } from "#result"
import * as v from "valibot"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectApplicationDeletedEventPayloadSchema } from "../events/projectApplicationDeletedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectApplicationDeleteOptions = {
  readonly applicationId: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly projectId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectApplicationDelete(
  options: ProjectApplicationDeleteOptions,
): Result<{ applicationId: string; deleted: boolean }> {
  const op = "projectApplicationDelete"
  const runtime = options.runtime ?? options.database.runtime
  const deletedAt = runtime.now()
  if (!Number.isSafeInteger(deletedAt) || deletedAt < 0)
    return resultErrorCreate(op, "The application timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = projectRepositoryCreate(transaction)
    const current = repository.projectApplicationGet(options.applicationId)
    if (!current.success) return current
    if (
      current.data === null ||
      current.data.realmId !== options.realmId ||
      current.data.projectId !== options.projectId
    )
      return resultCreate({ applicationId: options.applicationId, deleted: true })
    const project = repository.projectGet(options.projectId)
    if (!project.success) return project
    if (project.data === null || project.data.status !== "active")
      return resultErrorCreate(op, "The project was not found.")
    const authorized = projectContextAuthorize({
      context: options.context,
      database: options.database,
      realmId: options.realmId,
      permission: "project.app.delete",
      project: project.data,
    })
    if (!authorized.success) return authorized
    const deleted = repository.projectApplicationDelete(options.applicationId)
    if (!deleted.success) return deleted
    if (deleted.data === null) return resultCreate({ applicationId: options.applicationId, deleted: true })
    const payload = v.safeParse(projectApplicationDeletedEventPayloadSchema, {
      applicationId: options.applicationId,
      projectId: options.projectId,
    })
    if (!payload.success) return resultErrorCreate(op, "The application event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.applicationId,
        aggregateType: "project_application",
        aggregateVersion: deleted.data.version + 1,
        commandIndex: 0,
        correlationId,
        eventType: projectEventTypes.applicationDeleted,
        realmId: options.realmId,
        metadata: { source: "projects" },
        occurredAt: deletedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ applicationId: options.applicationId, deleted: true })
  })
}
