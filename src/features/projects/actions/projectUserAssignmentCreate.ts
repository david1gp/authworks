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
import { userGet } from "../../users/actions/userGet.js"
import { projectRoleKeysEncode } from "../domain/projectRoleKeysEncode.js"
import { projectUserAssignmentPublicViewCreate } from "../domain/projectUserAssignmentPublicViewCreate.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectUserAssignmentCreatedEventPayloadSchema } from "../events/projectUserAssignmentCreatedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import {
  type ProjectUserAssignmentCreateRequest,
  projectUserAssignmentCreateRequestSchema,
} from "../public/projectUserAssignmentCreateRequestSchema.js"
import type { ProjectUserAssignment } from "../public/projectUserAssignmentSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectUserAssignmentCreateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly input: ProjectUserAssignmentCreateRequest
  readonly projectId: string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectUserAssignmentCreate(
  options: ProjectUserAssignmentCreateOptions,
): Result<{ assignment: ProjectUserAssignment }> {
  const op = "projectUserAssignmentCreate"
  const parsed = v.safeParse(projectUserAssignmentCreateRequestSchema, options.input)
  if (!parsed.success)
    return resultErrorCodedCreate(op, "The project user assignment request is invalid.", "projects.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const createdAt = runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCodedCreate(op, "The project user assignment timestamp is invalid.", "projects.timestamp-invalid")
  const assignmentId = uuidv7Create(runtime)
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = projectRepositoryCreate(transaction)
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
    const user = userGet({
      context: options.context,
      database: options.database,
      realmId: options.realmId,
      userId: parsed.output.userId,
    })
    if (!user.success) return user
    const existing = repository.projectUserAssignmentGetByProjectUser(
      options.realmId,
      options.projectId,
      parsed.output.userId,
    )
    if (!existing.success) return existing
    if (existing.data !== null)
      return resultErrorCodedCreate(op, "The user is already assigned to this project.", "projects.already-exists")
    const roleKeys = parsed.output.roleKeys ?? []
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
    if (user.data.user.realmId !== options.realmId)
      return resultErrorCodedCreate(op, "The user was not found.", "users.not-found")
    const created = repository.projectUserAssignmentCreate({
      createdAt,
      id: assignmentId,
      projectId: options.projectId,
      realmId: options.realmId,
      roleKeys: encodedRoleKeys.data,
      updatedAt: createdAt,
      userId: parsed.output.userId,
      version: 1,
    })
    if (!created.success) return created
    const payload = v.safeParse(projectUserAssignmentCreatedEventPayloadSchema, {
      assignmentId,
      projectId: options.projectId,
      roleKeys,
      userId: parsed.output.userId,
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
        aggregateId: assignmentId,
        aggregateType: "project_user_assignment",
        aggregateVersion: 1,
        commandIndex: 0,
        correlationId,
        eventType: projectEventTypes.userAssignmentCreated,
        realmId: options.realmId,
        metadata: { source: "projects" },
        occurredAt: createdAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    const view = projectUserAssignmentPublicViewCreate(created.data)
    if (!view.success) return view
    return resultCreate({ assignment: view.data })
  })
}
