import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"
import { projectPublicViewCreate } from "../domain/projectPublicViewCreate.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { Project } from "../public/projectSchema.js"

type ProjectGetOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly projectId: string
}

export function projectGet(options: ProjectGetOptions): Result<{ project: Project }> {
  const op = "projectGet"
  if (options.context.kind === "tenant" && options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The project is not available in this tenant context.")
  const repository = projectRepositoryCreate(options.database.db)
  const project = repository.projectGet(options.projectId)
  if (!project.success) return project
  if (project.data === null || project.data.instanceId !== options.instanceId || project.data.status !== "active")
    return resultErrorCreate(op, "The project was not found.")
  const authorized = projectContextAuthorize({
    context: options.context,
    database: options.database,
    instanceId: options.instanceId,
    permission: "project.read",
    project: project.data,
  })
  if (!authorized.success) return authorized
  return resultCreate({ project: projectPublicViewCreate(project.data) })
}
