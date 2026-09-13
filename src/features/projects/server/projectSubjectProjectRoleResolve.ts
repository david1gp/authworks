import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { authorizationRoleKeysResolve } from "../../authorization/actions/authorizationRoleKeysResolve.js"
import { organizationPrimaryDomainResolve } from "../../organizations/server/organizationPrimaryDomainResolve.js"
import { organizationSubjectMembershipList } from "../../organizations/server/organizationSubjectMembershipList.js"
import { userRepositoryCreate } from "../../users/persistence/userRepositoryCreate.js"
import { projectRoleKeysDecode } from "../domain/projectRoleKeysDecode.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"

type ProjectSubjectProjectRoleResolveOptions = {
  readonly executor: StorageExecutor
  readonly projectId: string
  readonly realmId: string
  readonly userId: string
}

type ProjectSubjectProjectRole = {
  readonly organizationId: string
  readonly primaryDomain: string | undefined
  readonly roleKeys: string[]
}

export function projectSubjectProjectRoleResolve(
  options: ProjectSubjectProjectRoleResolveOptions,
): Result<ProjectSubjectProjectRole[]> {
  const op = "projectSubjectProjectRoleResolve"
  if (options.projectId.length === 0 || options.realmId.length === 0 || options.userId.length === 0)
    return resultErrorCodedCreate(op, "The project role context is invalid.", "projects.invalid")

  const repository = projectRepositoryCreate(options.executor)
  const project = repository.projectGet(options.projectId)
  if (!project.success) return project
  if (project.data === null || project.data.realmId !== options.realmId || project.data.status !== "active")
    return resultErrorCodedCreate(op, "The project was not found.", "projects.not-found")
  const projectData = project.data

  const user = userRepositoryCreate(options.executor).userGet(options.realmId, options.userId)
  if (!user.success) return user
  if (user.data === null || user.data.state !== "active" || user.data.deletedAt !== null) return resultCreate([])

  const memberships = organizationSubjectMembershipList({
    executor: options.executor,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!memberships.success) return memberships
  const membershipsByOrganizationId = new Map(
    memberships.data.map((membership) => [membership.organizationId, membership]),
  )

  const projectRoles = repository.projectRoleList(projectData.id)
  if (!projectRoles.success) return projectRoles
  const activeRoleKeys = new Set(
    projectRoles.data
      .filter((role) => role.realmId === options.realmId && role.projectId === projectData.id)
      .map((role) => role.key),
  )
  const roleKeysByOrganizationId = new Map<string, Set<string>>()

  const assignment = repository.projectUserAssignmentGetByProjectUser(options.realmId, projectData.id, options.userId)
  if (!assignment.success) return assignment
  if (assignment.data !== null) {
    const assignmentRoleKeys = projectRoleKeysDecode(assignment.data.roleKeys)
    if (!assignmentRoleKeys.success) return assignmentRoleKeys
    roleKeysAdd(
      roleKeysByOrganizationId,
      projectData.organizationId,
      assignmentRoleKeys.data.filter((roleKey) => activeRoleKeys.has(roleKey)),
    )
  }

  const grants = repository.projectGrantList(projectData.id)
  if (!grants.success) return grants
  for (const grant of grants.data) {
    if (
      grant.realmId !== options.realmId ||
      grant.projectId !== projectData.id ||
      grant.organizationId !== projectData.organizationId ||
      grant.grantedOrganizationId === projectData.organizationId ||
      grant.status !== "active"
    )
      continue
    const membership = membershipsByOrganizationId.get(grant.grantedOrganizationId)
    if (membership === undefined) continue
    const membershipAccess = authorizationRoleKeysResolve({ roles: membership.roles })
    if (!membershipAccess.success) return membershipAccess
    if (!membershipAccess.data.permissions.includes("project.read")) continue
    const grantRoleKeys = projectRoleKeysDecode(grant.roleKeys)
    if (!grantRoleKeys.success) return grantRoleKeys
    roleKeysAdd(
      roleKeysByOrganizationId,
      grant.grantedOrganizationId,
      grantRoleKeys.data.filter((roleKey) => activeRoleKeys.has(roleKey)),
    )
  }

  const results: ProjectSubjectProjectRole[] = []
  for (const [organizationId, roleKeys] of [...roleKeysByOrganizationId.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (roleKeys.size === 0) continue
    const primaryDomain = organizationPrimaryDomainResolve({
      executor: options.executor,
      organizationId,
      realmId: options.realmId,
    })
    if (!primaryDomain.success) return primaryDomain
    results.push({
      organizationId,
      primaryDomain: primaryDomain.data,
      roleKeys: [...roleKeys].sort(),
    })
  }
  return resultCreate(results)
}

function roleKeysAdd(target: Map<string, Set<string>>, organizationId: string, roleKeys: readonly string[]): void {
  if (roleKeys.length === 0) return
  const current = target.get(organizationId) ?? new Set<string>()
  for (const roleKey of roleKeys) current.add(roleKey)
  target.set(organizationId, current)
}
