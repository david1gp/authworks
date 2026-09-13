import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationEnforce } from "../../authorization/actions/authorizationEnforce.js"
import { authorizationRoleKeysResolve } from "../../authorization/actions/authorizationRoleKeysResolve.js"
import type { AuthorizationPermission } from "../../authorization/public/authorizationPermissionSchema.js"
import { organizationMembershipAccessList } from "../../organizations/actions/organizationMembershipAccessList.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { userRepositoryCreate } from "../../users/persistence/userRepositoryCreate.js"
import { projectRoleKeysDecode } from "../domain/projectRoleKeysDecode.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"
import type { ProjectRow } from "../persistence/projectTable.js"

type ProjectContextAuthorizeOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly permission: AuthorizationPermission
  readonly project: ProjectRow
}

export function projectContextAuthorize(
  options: ProjectContextAuthorizeOptions,
): Result<{ grantedOrganizationId?: string; roleKeys: string[] }> {
  const op = "projectContextAuthorize"
  if (options.context.kind === "system") return resultCreate({ roleKeys: [] })
  if (options.context.realmId !== options.realmId || options.project.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The project is not available in this tenant context.",
      "projects.tenant-mismatch",
    )
  if (options.context.actor.kind === "bootstrap_admin") {
    const authorized = authorizationEnforce({
      actor: options.context.actor,
      realmId: options.realmId,
      organizationId: options.project.organizationId,
      permission: options.permission,
    })
    if (!authorized.success) return authorized
    return resultCreate({ roleKeys: [] })
  }
  const actorUser = userRepositoryCreate(options.database.db).userGet(options.realmId, options.context.actorId)
  if (!actorUser.success) return actorUser
  if (actorUser.data !== null && (actorUser.data.state !== "active" || actorUser.data.deletedAt !== null))
    return resultErrorCodedCreate(op, "The actor is not authorized for this project.", "projects.forbidden")
  const memberships = organizationMembershipAccessList({
    database: options.database,
    realmId: options.realmId,
    userId: options.context.actorId,
  })
  if (!memberships.success) return memberships
  const repository = projectRepositoryCreate(options.database.db)
  const grants = repository.projectGrantList(options.project.id)
  if (!grants.success) return grants
  const roleKeys = new Set<string>()
  let grantedOrganizationId: string | undefined
  let authorized = false
  for (const membership of memberships.data.items) {
    if (membership.status !== "active") continue
    if (membership.organizationId === options.project.organizationId) {
      const ownerDecision = authorizationEnforce({
        actor: options.context.actor,
        realmId: options.realmId,
        organizationId: membership.organizationId,
        permission: options.permission,
        roles: membership.roles,
      })
      if (ownerDecision.success) authorized = true
      continue
    }
    const grant = grants.data.find(
      (candidate) => candidate.grantedOrganizationId === membership.organizationId && candidate.status === "active",
    )
    if (grant === undefined || !projectReadPermissionAllowed(options.permission)) continue
    const grantedDecision = authorizationEnforce({
      actor: options.context.actor,
      realmId: options.realmId,
      organizationId: membership.organizationId,
      permission: options.permission,
      roles: membership.roles,
    })
    if (grantedDecision.success) {
      const grantRoleKeys = projectRoleKeysRead(grant.roleKeys)
      if (!grantRoleKeys.success) return grantRoleKeys
      authorized = true
      grantedOrganizationId ??= membership.organizationId
      for (const roleKey of grantRoleKeys.data) roleKeys.add(roleKey)
    }
  }
  if (projectReadPermissionAllowed(options.permission)) {
    const assignment = repository.projectUserAssignmentGetByProjectUser(
      options.realmId,
      options.project.id,
      options.context.actorId,
    )
    if (!assignment.success) return assignment
    if (assignment.data !== null) {
      if (actorUser.data?.state === "active" && actorUser.data.deletedAt === null) {
        const assignmentRoleKeys = projectRoleKeysDecode(assignment.data.roleKeys)
        if (!assignmentRoleKeys.success) return assignmentRoleKeys
        const projectRoles = repository.projectRoleList(options.project.id)
        if (!projectRoles.success) return projectRoles
        const activeRoleKeys = new Set(
          projectRoles.data
            .filter((role) => role.realmId === options.realmId && role.projectId === options.project.id)
            .map((role) => role.key),
        )
        const resolved = authorizationRoleKeysResolve({
          roles: assignmentRoleKeys.data.filter((roleKey) => activeRoleKeys.has(roleKey)),
        })
        if (!resolved.success) return resolved
        if (options.permission === "project.read" || resolved.data.permissions.includes(options.permission))
          authorized = true
        for (const roleKey of assignmentRoleKeys.data) {
          if (activeRoleKeys.has(roleKey)) roleKeys.add(roleKey)
        }
      }
    }
  }
  if (!authorized)
    return resultErrorCodedCreate(op, "The actor is not authorized for this project.", "projects.forbidden")
  return resultCreate({
    ...(grantedOrganizationId === undefined ? {} : { grantedOrganizationId }),
    roleKeys: [...roleKeys].sort(),
  })
}

function projectReadPermissionAllowed(permission: AuthorizationPermission): boolean {
  return permission === "project.read" || permission === "project.role.read" || permission === "project.app.read"
}

function projectRoleKeysRead(input: string): Result<string[]> {
  try {
    const parsed = JSON.parse(input) as unknown
    if (!Array.isArray(parsed) || parsed.some((key) => typeof key !== "string"))
      return resultErrorCodedCreate(
        "projectContextAuthorize",
        "The project grant is invalid.",
        "projects.grant-invalid",
      )
    return resultCreate(parsed)
  } catch (_error) {
    return resultErrorCodedCreate("projectContextAuthorize", "The project grant is invalid.", "projects.grant-invalid")
  }
}
