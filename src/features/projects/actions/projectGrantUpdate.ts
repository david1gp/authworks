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
import { projectGrantPublicViewCreate } from "../domain/projectGrantPublicViewCreate.js"
import { projectRoleKeysEncode } from "../domain/projectRoleKeysEncode.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectGrantUpdatedEventPayloadSchema } from "../events/projectGrantUpdatedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import {
  projectGrantUpdateRequestSchema,
  type ProjectGrantUpdateRequest,
} from "../public/projectGrantUpdateRequestSchema.js"
import type { ProjectGrant } from "../public/projectGrantSchema.js"
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
  const parsed = v.safeParse(projectGrantUpdateRequestSchema, options.input)
  if (!parsed.success) return resultErrorCreate(op, "The project grant update is invalid.")
  const runtime = options.runtime ?? options.database.runtime
  const updatedAt = runtime.now()
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
    return resultErrorCreate(op, "The project grant timestamp is invalid.")
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
      return resultErrorCreate(op, "The project grant was not found.")
    const project = repository.projectGet(options.projectId)
    if (!project.success) return project
    if (project.data === null || project.data.status !== "active")
      return resultErrorCreate(op, "The project was not found.")
    const authorized = projectContextAuthorize({
      context: options.context,
      database: options.database,
      realmId: options.realmId,
      permission: "project.grant.write",
      project: project.data,
    })
    if (!authorized.success) return authorized
    if (parsed.output.grantedOrganizationId !== current.data.grantedOrganizationId)
      return resultErrorCreate(op, "The granted organization cannot be changed.")
    const roles = projectRoleKeysEncode(parsed.output.roleKeys)
    if (!roles.success) return roles
    const projectRoles = repository.projectRoleList(options.projectId)
    if (!projectRoles.success) return projectRoles
    if (parsed.output.roleKeys.some((key) => !projectRoles.data.some((role) => role.key === key)))
      return resultErrorCreate(op, "Every granted role key must belong to the project.")
    const updated = repository.projectGrantUpdate(options.grantId, {
      roleKeys: roles.data,
      updatedAt,
      version: current.data.version + 1,
    })
    if (!updated.success) return updated
    if (updated.data === null) return resultErrorCreate(op, "The project grant was not found.")
    const payload = v.safeParse(projectGrantUpdatedEventPayloadSchema, {
      grantedOrganizationId: updated.data.grantedOrganizationId,
      grantId: options.grantId,
      projectId: options.projectId,
      roleKeys: parsed.output.roleKeys,
    })
    if (!payload.success) return resultErrorCreate(op, "The project grant event payload is invalid.")
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
