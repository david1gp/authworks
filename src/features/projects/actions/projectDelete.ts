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
import { projectDeletedEventPayloadSchema } from "../events/projectDeletedEventPayloadSchema.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectDeleteOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly projectId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectDelete(options: ProjectDeleteOptions): Result<{ deleted: boolean; projectId: string }> {
  const op = "projectDelete"
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The project is not available in this tenant context.",
      "projects.tenant-mismatch",
    )
  const runtime = options.runtime ?? options.database.runtime
  const deletedAt = runtime.now()
  if (!Number.isSafeInteger(deletedAt) || deletedAt < 0)
    return resultErrorCodedCreate(op, "The project timestamp is invalid.", "projects.timestamp-invalid")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = projectRepositoryCreate(transaction)
    const current = repository.projectGet(options.projectId)
    if (!current.success) return current
    if (current.data === null || current.data.realmId !== options.realmId)
      return resultCreate({ deleted: true, projectId: options.projectId })
    const authorized = projectContextAuthorize({
      context: options.context,
      database: options.database,
      realmId: options.realmId,
      permission: "project.delete",
      project: current.data,
    })
    if (!authorized.success) return authorized
    const deleted = repository.projectDelete(options.projectId)
    if (!deleted.success) return deleted
    if (deleted.data === null) return resultCreate({ deleted: true, projectId: options.projectId })
    const payload = v.safeParse(projectDeletedEventPayloadSchema, { projectId: options.projectId })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The project event payload is invalid.", "projects.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.projectId,
        aggregateType: "project",
        aggregateVersion: deleted.data.version + 1,
        commandIndex: 0,
        correlationId,
        eventType: projectEventTypes.deleted,
        realmId: options.realmId,
        metadata: { source: "projects" },
        occurredAt: deletedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ deleted: true, projectId: options.projectId })
  })
}
