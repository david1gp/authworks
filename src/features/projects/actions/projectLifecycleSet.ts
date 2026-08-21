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
import { projectPublicViewCreate } from "../domain/projectPublicViewCreate.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectStatusChangedEventPayloadSchema } from "../events/projectStatusChangedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import { type ProjectLifecycleRequest, projectLifecycleRequestSchema } from "../public/projectLifecycleRequestSchema.js"
import type { Project } from "../public/projectSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectLifecycleSetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: ProjectLifecycleRequest
  readonly realmId: string
  readonly projectId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectLifecycleSet(options: ProjectLifecycleSetOptions): Result<{ project: Project }> {
  const op = "projectLifecycleSet"
  const parsed = v.safeParse(projectLifecycleRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCodedCreate(op, "The project lifecycle request is invalid.", "projects.invalid")
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The project is not available in this tenant context.",
      "projects.tenant-mismatch",
    )
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCodedCreate(op, "The project timestamp is invalid.", "projects.timestamp-invalid")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = projectRepositoryCreate(transaction)
    const current = repository.projectGet(options.projectId)
    if (!current.success) return current
    if (current.data === null || current.data.realmId !== options.realmId)
      return resultErrorCodedCreate(op, "The project was not found.", "projects.not-found")
    if (current.data.status === "removed")
      return resultErrorCodedCreate(op, "The project has been removed.", "projects.removed")
    if (current.data.status === parsed.output.status)
      return resultErrorCodedCreate(op, "The project already has that status.", "projects.conflict")
    const authorized = projectContextAuthorize({
      context: options.context,
      database: options.database,
      realmId: options.realmId,
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
    if (updated.data === null) return resultErrorCodedCreate(op, "The project was not found.", "projects.not-found")
    const payload = v.safeParse(projectStatusChangedEventPayloadSchema, { status: updated.data.status })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The project event payload is invalid.", "projects.event-invalid")
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
        realmId: options.realmId,
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
