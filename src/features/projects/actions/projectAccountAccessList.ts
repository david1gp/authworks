import { type Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationRoleKeysResolve } from "../../authorization/actions/authorizationRoleKeysResolve.js"
import type { AuthorizationPermission } from "../../authorization/public/authorizationPermissionSchema.js"
import { organizationAccountAccessActiveIdList } from "../../organizations/actions/organizationAccountAccessActiveIdList.js"
import { projectGrantPublicViewCreate } from "../domain/projectGrantPublicViewCreate.js"
import { projectPublicViewCreate } from "../domain/projectPublicViewCreate.js"
import { projectRoleKeysDecode } from "../domain/projectRoleKeysDecode.js"
import { projectRolePublicViewCreate } from "../domain/projectRolePublicViewCreate.js"
import { projectUserAssignmentPublicViewCreate } from "../domain/projectUserAssignmentPublicViewCreate.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { ProjectAccountAccessListResponse } from "../public/projectAccountAccessListResponseSchema.js"
import { userRepositoryCreate } from "../../users/persistence/userRepositoryCreate.js"

type ProjectAccountAccessListOptions = {
  readonly database: StorageDatabase
  readonly organizationIds: readonly string[]
  readonly realmId: string
  readonly userId?: string
}

export function projectAccountAccessList(
  options: ProjectAccountAccessListOptions,
): Result<ProjectAccountAccessListResponse> {
  const op = "projectAccountAccessList"
  if (
    options.realmId.length === 0 ||
    options.organizationIds.some((organizationId) => organizationId.length === 0) ||
    (options.userId !== undefined && options.userId.length === 0)
  )
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
  let directAssignmentsEnabled = false
  if (options.userId !== undefined) {
    const user = userRepositoryCreate(options.database.db).userGet(options.realmId, options.userId)
    if (!user.success) return user
    if (user.data === null || user.data.state !== "active" || user.data.deletedAt !== null)
      return { data: { items: [] }, success: true }
    directAssignmentsEnabled = true
  }
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
    if (!directAssignmentsEnabled || options.userId === undefined) continue
    const assignment = repository.projectUserAssignmentGetByProjectUser(options.realmId, project.id, options.userId)
    if (!assignment.success) return assignment
    if (assignment.data === null) continue
    const roleKeys = projectRoleKeysDecode(assignment.data.roleKeys)
    if (!roleKeys.success) return roleKeys
    const activeAssignmentRoleKeys = roleKeys.data.filter((roleKey) => activeRoleKeys.has(roleKey))
    const permissions = authorizationRoleKeysResolve({ roles: activeAssignmentRoleKeys })
    if (!permissions.success) return permissions
    const assignmentView = projectUserAssignmentPublicViewCreate(assignment.data)
    if (!assignmentView.success) return assignmentView
    const id = `assignment:${project.id}:${assignment.data.id}`
    if (seen.has(id)) continue
    seen.add(id)
    items.push({
      assignment: { ...assignmentView.data, roleKeys: activeAssignmentRoleKeys },
      organizationId: project.organizationId,
      permissions: permissions.data.permissions.filter(projectAssignmentPermissionAllowed),
      project: projectPublicViewCreate(project),
      roleDefinitions,
      roleKeys: activeAssignmentRoleKeys,
    })
  }
  items.sort((left, right) => {
    const leftSource = left.assignment === undefined ? (left.grant === undefined ? "owner" : "grant") : "assignment"
    const rightSource = right.assignment === undefined ? (right.grant === undefined ? "owner" : "grant") : "assignment"
    const leftId = `${left.project.id}:${left.organizationId}:${leftSource}`
    const rightId = `${right.project.id}:${right.organizationId}:${rightSource}`
    return leftId.localeCompare(rightId)
  })
  return { data: { items }, success: true }
}

function projectAssignmentPermissionAllowed(permission: AuthorizationPermission): boolean {
  return permission === "project.read" || permission === "project.role.read" || permission === "project.app.read"
}
