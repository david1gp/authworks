import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { projectApplicationPublicViewCreate } from "../domain/projectApplicationPublicViewCreate.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { ProjectApplication } from "../public/projectApplicationSchema.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"

type ProjectApplicationGetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly applicationId: string
  readonly realmId: string
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
    application.data.realmId !== options.realmId ||
    application.data.projectId !== options.projectId ||
    application.data.status !== "active"
  )
    return resultErrorCodedCreate(op, "The application was not found.", "projects.not-found")
  const project = repository.projectGet(options.projectId)
  if (!project.success) return project
  if (project.data === null || project.data.status !== "active")
    return resultErrorCodedCreate(op, "The project was not found.", "projects.not-found")
  const authorized = projectContextAuthorize({
    context: options.context,
    database: options.database,
    realmId: options.realmId,
    permission: "project.app.read",
    project: project.data,
  })
  if (!authorized.success) return authorized
  return resultCreate({ application: projectApplicationPublicViewCreate(application.data) })
}
