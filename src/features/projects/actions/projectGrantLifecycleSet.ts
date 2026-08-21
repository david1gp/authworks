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
import { projectGrantPublicViewCreate } from "../domain/projectGrantPublicViewCreate.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectGrantStatusChangedEventPayloadSchema } from "../events/projectGrantStatusChangedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import {
  type ProjectGrantLifecycleRequest,
  projectGrantLifecycleRequestSchema,
} from "../public/projectGrantLifecycleRequestSchema.js"
import type { ProjectGrant } from "../public/projectGrantSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectGrantLifecycleSetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly grantId: string
  readonly input: ProjectGrantLifecycleRequest
  readonly realmId: string
  readonly projectId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectGrantLifecycleSet(options: ProjectGrantLifecycleSetOptions): Result<{ grant: ProjectGrant }> {
  const op = "projectGrantLifecycleSet"
  const parsed = v.safeParse(projectGrantLifecycleRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCodedCreate(op, "The project grant lifecycle request is invalid.", "projects.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
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
      return resultErrorCodedCreate(op, "The project grant was not found.", "projects.not-found")
    if (current.data.status === "removed")
      return resultErrorCodedCreate(op, "The project grant has been removed.", "projects.removed")
    if (current.data.status === parsed.output.status)
      return resultErrorCodedCreate(op, "The project grant already has that status.", "projects.conflict")
    const project = repository.projectGet(options.projectId)
    if (!project.success) return project
    if (project.data === null || project.data.status !== "active")
      return resultErrorCodedCreate(op, "The project was not found.", "projects.not-found")
    const authorized = projectContextAuthorize({
      context: options.context,
      database: options.database,
      realmId: options.realmId,
      permission: "project.grant.write",
      project: project.data,
    })
    if (!authorized.success) return authorized
    const updated = repository.projectGrantUpdate(options.grantId, {
      status: parsed.output.status,
      updatedAt,
      version: current.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null)
      return resultErrorCodedCreate(op, "The project grant was not found.", "projects.not-found")
    const payload = v.safeParse(projectGrantStatusChangedEventPayloadSchema, {
      grantId: options.grantId,
      status: updated.data.status,
    })
    if (!payload.success)
      return resultErrorCodedCreate(op, "The project grant event payload is invalid.", "projects.event-invalid")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.grantId,
        aggregateType: "project_grant",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: projectEventTypes.grantStatusChanged,
        realmId: options.realmId,
        metadata: { source: "projects" },
        occurredAt: updatedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    const view = projectGrantPublicViewCreate(updated.data)
    if (!view.success) return view
    return resultCreate({ grant: view.data })
  })
}
