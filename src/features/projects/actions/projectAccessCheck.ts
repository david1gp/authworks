import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"

type ProjectAccessCheckOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly projectId: string
}

export function projectAccessCheck(
  options: ProjectAccessCheckOptions,
): Result<{ grantedOrganizationId?: string; projectId: string; roleKeys: string[] }> {
  const repository = projectRepositoryCreate(options.database.db)
  const project = repository.projectGet(options.projectId)
  if (!project.success) return project
  if (project.data === null || project.data.instanceId !== options.instanceId || project.data.status !== "active")
    return { errorMessage: "The project was not found.", op: "projectAccessCheck", success: false }
  const authorized = projectContextAuthorize({
    context: options.context,
    database: options.database,
    instanceId: options.instanceId,
    permission: "project.read",
    project: project.data,
  })
  if (!authorized.success) return authorized
  return resultCreate({
    projectId: options.projectId,
    roleKeys: authorized.data.roleKeys,
    ...("grantedOrganizationId" in authorized.data && authorized.data.grantedOrganizationId !== undefined
      ? { grantedOrganizationId: authorized.data.grantedOrganizationId }
      : {}),
  })
}
