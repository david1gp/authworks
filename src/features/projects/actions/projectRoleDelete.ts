import { type Result } from "#result"
import * as v from "valibot"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageEventAppend } from "../../../platform/storage/storageEventAppend.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { projectRoleKeysDecode } from "../domain/projectRoleKeysDecode.js"
import { projectEventTypes } from "../events/projectEventTypes.js"
import { projectGrantUpdatedEventPayloadSchema } from "../events/projectGrantUpdatedEventPayloadSchema.js"
import { projectRoleDeletedEventPayloadSchema } from "../events/projectRoleDeletedEventPayloadSchema.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectRoleDeleteOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly projectId: string
  readonly roleId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly correlationId?: string
}

export function projectRoleDelete(options: ProjectRoleDeleteOptions): Result<{ deleted: boolean; roleId: string }> {
  const op = "projectRoleDelete"
  const runtime = options.runtime ?? options.database.runtime
  const deletedAt = runtime.now()
  if (!Number.isSafeInteger(deletedAt) || deletedAt < 0)
    return resultErrorCreate(op, "The project role timestamp is invalid.")
  const correlationId = options.correlationId ?? uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = projectRepositoryCreate(transaction)
    const current = repository.projectRoleGet(options.roleId)
    if (!current.success) return current
    if (
      current.data === null ||
      current.data.instanceId !== options.instanceId ||
      current.data.projectId !== options.projectId
    )
      return resultCreate({ deleted: true, roleId: options.roleId })
    const project = repository.projectGet(options.projectId)
    if (!project.success) return project
    if (project.data === null || project.data.status !== "active")
      return resultErrorCreate(op, "The project was not found.")
    const authorized = projectContextAuthorize({
      context: options.context,
      database: options.database,
      instanceId: options.instanceId,
      permission: "project.role.write",
      project: project.data,
    })
    if (!authorized.success) return authorized
    const grants = repository.projectGrantList(options.projectId)
    if (!grants.success) return grants
    const roleKey = current.data.key
    let commandIndex = 0
    for (const grant of grants.data) {
      const roleKeys = projectRoleKeysDecode(grant.roleKeys)
      if (!roleKeys.success) return roleKeys
      if (!roleKeys.data.includes(roleKey)) continue
      const updatedRoleKeys = roleKeys.data.filter((key) => key !== roleKey)
      const updatedGrant = repository.projectGrantUpdate(grant.id, {
        roleKeys: JSON.stringify(updatedRoleKeys),
        updatedAt: deletedAt,
        version: grant.version + 1,
      })
      if (!updatedGrant.success) return updatedGrant
      if (updatedGrant.data === null) return resultErrorCreate(op, "The project grant was not found.")
      const grantPayload = v.safeParse(projectGrantUpdatedEventPayloadSchema, {
        grantedOrganizationId: grant.grantedOrganizationId,
        grantId: grant.id,
        projectId: options.projectId,
        roleKeys: updatedRoleKeys,
      })
      if (!grantPayload.success) return resultErrorCreate(op, "The project grant event payload is invalid.")
      const grantEvent = storageEventAppend(
        transaction,
        {
          actorId: options.context.actorId,
          aggregateId: grant.id,
          aggregateType: "project_grant",
          aggregateVersion: updatedGrant.data.version,
          commandIndex: commandIndex++,
          correlationId,
          eventType: projectEventTypes.grantUpdated,
          instanceId: options.instanceId,
          metadata: { source: "projects" },
          occurredAt: deletedAt,
          payload: grantPayload.output,
        },
        runtime,
      )
      if (!grantEvent.success) return grantEvent
    }
    const deleted = repository.projectRoleDelete(options.roleId)
    if (!deleted.success) return deleted
    if (deleted.data === null) return resultCreate({ deleted: true, roleId: options.roleId })
    const payload = v.safeParse(projectRoleDeletedEventPayloadSchema, {
      key: roleKey,
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
        aggregateVersion: current.data.version + 1,
        commandIndex,
        correlationId,
        eventType: projectEventTypes.roleDeleted,
        instanceId: options.instanceId,
        metadata: { source: "projects" },
        occurredAt: deletedAt,
        payload: payload.output,
      },
      runtime,
    )
    if (!event.success) return event
    return resultCreate({ deleted: true, roleId: options.roleId })
  })
}
