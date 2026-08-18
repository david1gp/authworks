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
import { projectRolePublicViewCreate } from "../domain/projectRolePublicViewCreate.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectRoleUpdatedEventPayloadSchema } from "../events/projectRoleUpdatedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import {
  projectRoleUpdateRequestSchema,
  type ProjectRoleUpdateRequest,
} from "../public/projectRoleUpdateRequestSchema.js"
import type { ProjectRole } from "../public/projectRoleSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectRoleUpdateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: ProjectRoleUpdateRequest
  readonly realmId: string
  readonly projectId: string
  readonly roleId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectRoleUpdate(options: ProjectRoleUpdateOptions): Result<{ role: ProjectRole }> {
  const op = "projectRoleUpdate"
  const parsed = v.safeParse(projectRoleUpdateRequestSchema, options.input)
  if (!parsed.success || (parsed.output.displayName === undefined && parsed.output.group === undefined))
    return resultErrorCreate(op, "The project role update is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCreate(op, "The project role timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = projectRepositoryCreate(transaction)
    const current = repository.projectRoleGet(options.roleId)
    if (!current.success) return current
    if (
      current.data === null ||
      current.data.realmId !== options.realmId ||
      current.data.projectId !== options.projectId
    )
      return resultErrorCreate(op, "The project role was not found.")
    const project = repository.projectGet(options.projectId)
    if (!project.success) return project
    if (project.data === null || project.data.status !== "active")
      return resultErrorCreate(op, "The project was not found.")
    const authorized = projectContextAuthorize({
      context: options.context,
      database: options.database,
      realmId: options.realmId,
      permission: "project.role.write",
      project: project.data,
    })
    if (!authorized.success) return authorized
    const updated = repository.projectRoleUpdate(options.roleId, {
      ...(parsed.output.displayName === undefined ? {} : { displayName: parsed.output.displayName }),
      ...(parsed.output.group === undefined ? {} : { group: parsed.output.group }),
      updatedAt,
      version: current.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The project role was not found.")
    const payload = v.safeParse(projectRoleUpdatedEventPayloadSchema, {
      displayName: updated.data.displayName,
      ...(updated.data.group === null ? {} : { group: updated.data.group }),
      key: updated.data.key,
      projectId: options.projectId,
      roleId: options.roleId,
    })
    if (!payload.success) return resultErrorCreate(op, "The project role event payload is invalid.")
    const event = storageEventAppend(
      transaction,
      {
        actorId: options.context.actorId,
        aggregateId: options.roleId,
        aggregateType: "project_role",
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: projectEventTypes.roleUpdated,
        realmId: options.realmId,
        metadata: { source: "projects" },
        occurredAt: updatedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ role: projectRolePublicViewCreate(updated.data) })
  })
}
