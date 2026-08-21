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
import { projectGrantPublicViewCreate } from "../domain/projectGrantPublicViewCreate.js"
import { projectRoleKeysDecode } from "../domain/projectRoleKeysDecode.js"
import { projectRoleKeysEncode } from "../domain/projectRoleKeysEncode.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectGrantUpdatedEventPayloadSchema } from "../events/projectGrantUpdatedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { ProjectGrant } from "../public/projectGrantSchema.js"
import {
  type ProjectGrantUpdateRequest,
  projectGrantUpdateRequestSchema,
} from "../public/projectGrantUpdateRequestSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectGrantUpdateOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly grantId: string
  readonly input: ProjectGrantUpdateRequest
  readonly realmId: string
  readonly projectId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectGrantUpdate(options: ProjectGrantUpdateOptions): Result<{ grant: ProjectGrant }> {
  const op = "projectGrantUpdate"
  const parsed = patchInputParse(op, projectGrantUpdateRequestSchema, options.input, "projects.empty-patch")
  if (!parsed.success) return parsed
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
    if (
      parsed.data.grantedOrganizationId !== undefined &&
      parsed.data.grantedOrganizationId !== current.data.grantedOrganizationId
    )
      return resultErrorCodedCreate(op, "The granted organization cannot be changed.", "projects.cannot-change")
    const currentRoleKeys = projectRoleKeysDecode(current.data.roleKeys)
    if (!currentRoleKeys.success) return currentRoleKeys
    const roleKeys = parsed.data.roleKeys ?? currentRoleKeys.data
    const roles = projectRoleKeysEncode(roleKeys)
    if (!roles.success) return roles
    const projectRoles = repository.projectRoleList(options.projectId)
    if (!projectRoles.success) return projectRoles
    if (roleKeys.some((key) => !projectRoles.data.some((role) => role.key === key)))
      return resultErrorCodedCreate(
        op,
        "Every granted role key must belong to the project.",
        "projects.role-keys-invalid",
      )
    const updated = repository.projectGrantUpdate(options.grantId, {
      roleKeys: roles.data,
      updatedAt,
      version: current.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null)
      return resultErrorCodedCreate(op, "The project grant was not found.", "projects.not-found")
    const payload = v.safeParse(projectGrantUpdatedEventPayloadSchema, {
      grantedOrganizationId: updated.data.grantedOrganizationId,
      grantId: options.grantId,
      projectId: options.projectId,
      roleKeys,
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
        eventType: projectEventTypes.grantUpdated,
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
