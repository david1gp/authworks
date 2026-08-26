import { type Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationRoleKeysResolve } from "../../authorization/actions/authorizationRoleKeysResolve.js"
import { organizationAccountAccessActiveIdList } from "../../organizations/actions/organizationAccountAccessActiveIdList.js"
import { projectGrantPublicViewCreate } from "../domain/projectGrantPublicViewCreate.js"
import { projectPublicViewCreate } from "../domain/projectPublicViewCreate.js"
import { projectRoleKeysDecode } from "../domain/projectRoleKeysDecode.js"
import { projectRolePublicViewCreate } from "../domain/projectRolePublicViewCreate.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { ProjectAccountAccessListResponse } from "../public/projectAccountAccessListResponseSchema.js"

type ProjectAccountAccessListOptions = {
  readonly database: StorageDatabase
  readonly organizationIds: readonly string[]
  readonly realmId: string
}

export function projectAccountAccessList(
  options: ProjectAccountAccessListOptions,
): Result<ProjectAccountAccessListResponse> {
  const op = "projectAccountAccessList"
  if (options.realmId.length === 0 || options.organizationIds.some((organizationId) => organizationId.length === 0))
    return resultErrorCodedCreate(op, "The account access context is invalid.", "projects.invalid")
  const organizationIds = new Set(options.organizationIds)
  const repository = projectRepositoryCreate(options.database.db)
  const projects = repository.projectList(options.realmId)
  if (!projects.success) return projects
  const activeOwnerOrganizations = organizationAccountAccessActiveIdList({
    database: options.database,
    organizationIds: projects.data.map((project) => project.organizationId),
    realmId: options.realmId,
  })
  if (!activeOwnerOrganizations.success) return activeOwnerOrganizations
  const activeOwnerOrganizationIds = new Set(activeOwnerOrganizations.data)
  const items: ProjectAccountAccessListResponse["items"] = []
  const seen = new Set<string>()

  for (const project of projects.data) {
    if (
      project.realmId !== options.realmId ||
      project.status !== "active" ||
      !activeOwnerOrganizationIds.has(project.organizationId)
    )
      continue
    const grants = repository.projectGrantList(project.id)
    if (!grants.success) return grants
    const roles = repository.projectRoleList(project.id)
    if (!roles.success) return roles
    const roleDefinitions = roles.data
      .filter((role) => role.realmId === options.realmId && role.projectId === project.id)
      .map(projectRolePublicViewCreate)
    const activeRoleKeys = new Set(roleDefinitions.map((role) => role.key))
    if (organizationIds.has(project.organizationId)) {
      const id = `owner:${project.id}:${project.organizationId}`
      if (!seen.has(id)) {
        seen.add(id)
        items.push({
          organizationId: project.organizationId,
          permissions: [],
          project: projectPublicViewCreate(project),
          roleDefinitions,
          roleKeys: [],
        })
      }
    }
    for (const grant of grants.data) {
      if (
        grant.realmId !== options.realmId ||
        grant.projectId !== project.id ||
        grant.organizationId !== project.organizationId ||
        grant.status !== "active" ||
        !organizationIds.has(grant.grantedOrganizationId)
      )
        continue
      const roleKeys = projectRoleKeysDecode(grant.roleKeys)
      if (!roleKeys.success) return roleKeys
      const activeGrantRoleKeys = roleKeys.data.filter((roleKey) => activeRoleKeys.has(roleKey))
      const permissions = authorizationRoleKeysResolve({ roles: activeGrantRoleKeys })
      if (!permissions.success) return permissions
      const grantView = projectGrantPublicViewCreate(grant)
      if (!grantView.success) return grantView
      const id = `grant:${project.id}:${grant.grantedOrganizationId}`
      if (seen.has(id)) continue
      seen.add(id)
      items.push({
        grant: { ...grantView.data, roleKeys: activeGrantRoleKeys },
        organizationId: grant.grantedOrganizationId,
        permissions: permissions.data.permissions,
        project: projectPublicViewCreate(project),
        roleDefinitions,
        roleKeys: activeGrantRoleKeys,
      })
    }
  }
  items.sort((left, right) => {
    const leftId = `${left.project.id}:${left.organizationId}:${left.grant === undefined ? "owner" : "grant"}`
    const rightId = `${right.project.id}:${right.organizationId}:${right.grant === undefined ? "owner" : "grant"}`
    return leftId.localeCompare(rightId)
  })
  return { data: { items }, success: true }
}
