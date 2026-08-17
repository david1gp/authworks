import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { projectApplicationPublicViewCreate } from "../domain/projectApplicationPublicViewCreate.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { ProjectApplication } from "../public/projectApplicationSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectApplicationGetOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly applicationId: string
  readonly instanceId: string
  readonly projectId: string
}

export function projectApplicationGet(
  options: ProjectApplicationGetOptions,
): Result<{ application: ProjectApplication }> {
  const op = "projectApplicationGet"
  const repository = projectRepositoryCreate(options.database.db)
  const application = repository.projectApplicationGet(options.applicationId)
  if (!application.success) return application
  if (
    application.data === null ||
    application.data.instanceId !== options.instanceId ||
    application.data.projectId !== options.projectId ||
    application.data.status !== "active"
  )
    return resultErrorCreate(op, "The application was not found.")
  const project = repository.projectGet(options.projectId)
  if (!project.success) return project
  if (project.data === null || project.data.status !== "active")
    return resultErrorCreate(op, "The project was not found.")
  const authorized = projectContextAuthorize({
    context: options.context,
    database: options.database,
    instanceId: options.instanceId,
    permission: "project.app.read",
    project: project.data,
  })
  if (!authorized.success) return authorized
  return resultCreate({ application: projectApplicationPublicViewCreate(application.data) })
}
