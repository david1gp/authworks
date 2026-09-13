import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { patchInputParse } from "../../../platform/http/patchInputParse.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { projectRoleKeysDecode } from "../domain/projectRoleKeysDecode.js"
import { projectRoleKeysEncode } from "../domain/projectRoleKeysEncode.js"
import { projectUserAssignmentPublicViewCreate } from "../domain/projectUserAssignmentPublicViewCreate.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectUserAssignmentUpdatedEventPayloadSchema } from "../events/projectUserAssignmentUpdatedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { ProjectUserAssignment } from "../public/projectUserAssignmentSchema.js"
import {
  type ProjectUserAssignmentUpdateRequest,
  projectUserAssignmentUpdateRequestSchema,
} from "../public/projectUserAssignmentUpdateRequestSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectUserAssignmentUpdateOptions = {
  readonly assignmentId: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: ProjectUserAssignmentUpdateRequest
  readonly projectId: string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectUserAssignmentUpdate(
  options: ProjectUserAssignmentUpdateOptions,
): Result<{ assignment: ProjectUserAssignment }> {
  const op = "projectUserAssignmentUpdate"
  const parsed = patchInputParse(op, projectUserAssignmentUpdateRequestSchema, options.input, "projects.empty-patch")
  if (!parsed.success) return parsed
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
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
      return resultErrorCodedCreate(op, "The project user assignment was not found.", "projects.not-found")
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
    const currentRoleKeys = projectRoleKeysDecode(current.data.roleKeys)
    if (!currentRoleKeys.success) return currentRoleKeys
    const roleKeys = parsed.data.roleKeys ?? currentRoleKeys.data
    const encodedRoleKeys = projectRoleKeysEncode(roleKeys)
    if (!encodedRoleKeys.success) return encodedRoleKeys
    const projectRoles = repository.projectRoleList(options.projectId)
    if (!projectRoles.success) return projectRoles
    if (roleKeys.some((key) => !projectRoles.data.some((role) => role.key === key)))
      return resultErrorCodedCreate(
        op,
        "Every assigned role key must belong to the project.",
        "projects.role-keys-invalid",
      )
    const updated = repository.projectUserAssignmentUpdate(options.assignmentId, {
      roleKeys: encodedRoleKeys.data,
      updatedAt,
      version: current.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null)
      return resultErrorCodedCreate(op, "The project user assignment was not found.", "projects.not-found")
    const payload = v.safeParse(projectUserAssignmentUpdatedEventPayloadSchema, {
      assignmentId: options.assignmentId,
      projectId: options.projectId,
      roleKeys,
      userId: updated.data.userId,
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
        aggregateVersion: updated.data.version,
        commandIndex: 0,
        correlationId,
        eventType: projectEventTypes.userAssignmentUpdated,
        realmId: options.realmId,
        metadata: { source: "projects" },
        occurredAt: updatedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    const view = projectUserAssignmentPublicViewCreate(updated.data)
    if (!view.success) return view
    return resultCreate({ assignment: view.data })
  })
}
