import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"
import { projectPublicViewCreate } from "../domain/projectPublicViewCreate.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { Project } from "../public/projectSchema.js"

type ProjectGetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly projectId: string
}

export function projectGet(options: ProjectGetOptions): Result<{ project: Project }> {
  const op = "projectGet"
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The project is not available in this tenant context.")
  const repository = projectRepositoryCreate(options.database.db)
  const project = repository.projectGet(options.projectId)
  if (!project.success) return project
  if (project.data === null || project.data.realmId !== options.realmId || project.data.status !== "active")
    return resultErrorCreate(op, "The project was not found.")
  const authorized = projectContextAuthorize({
    context: options.context,
    database: options.database,
    realmId: options.realmId,
    permission: "project.read",
    project: project.data,
  })
  if (!authorized.success) return authorized
  return resultCreate({ project: projectPublicViewCreate(project.data) })
}
