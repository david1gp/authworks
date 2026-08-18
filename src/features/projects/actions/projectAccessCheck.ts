import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { projectContextAuthorize } from "./projectContextAuthorize.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"

type ProjectAccessCheckOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly projectId: string
}

export function projectAccessCheck(
  options: ProjectAccessCheckOptions,
): Result<{ grantedOrganizationId?: string; projectId: string; roleKeys: string[] }> {
  const repository = projectRepositoryCreate(options.database.db)
  const project = repository.projectGet(options.projectId)
  if (!project.success) return project
  if (project.data === null || project.data.realmId !== options.realmId || project.data.status !== "active")
    return { errorMessage: "The project was not found.", op: "projectAccessCheck", success: false }
  const authorized = projectContextAuthorize({
    context: options.context,
    database: options.database,
    realmId: options.realmId,
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
