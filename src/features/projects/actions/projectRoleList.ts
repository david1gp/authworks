import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { projectRolePublicViewCreate } from "../domain/projectRolePublicViewCreate.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { ProjectRole } from "../public/projectRoleSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectRoleListOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly projectId: string
}

export function projectRoleList(options: ProjectRoleListOptions): Result<{ roles: ProjectRole[] }> {
  const op = "projectRoleList"
  const repository = projectRepositoryCreate(options.database.db)
  const project = repository.projectGet(options.projectId)
  if (!project.success) return project
  if (project.data === null || project.data.instanceId !== options.instanceId || project.data.status !== "active")
    return resultErrorCreate(op, "The project was not found.")
  const authorized = projectContextAuthorize({
    context: options.context,
    database: options.database,
    instanceId: options.instanceId,
    permission: "project.role.read",
    project: project.data,
  })
  if (!authorized.success) return authorized
  const rows = repository.projectRoleList(options.projectId)
  if (!rows.success) return rows
  return resultCreate({ roles: rows.data.map(projectRolePublicViewCreate) })
}
