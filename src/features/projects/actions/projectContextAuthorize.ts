import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationEnforce } from "../../authorization/public/authorizationEnforce.js"
import type { AuthorizationPermission } from "../../authorization/public/authorizationPermissionSchema.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationMembershipAccessList } from "../../organizations/actions/organizationMembershipAccessList.js"
import type { ProjectRow } from "../persistence/projectTable.js"
import { projectRepositoryCreate } from "../persistence/projectRepositoryCreate.js"

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
    return resultErrorCreate(op, "The project is not available in this tenant context.")
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
  const memberships = organizationMembershipAccessList({
    database: options.database,
    realmId: options.realmId,
    userId: options.context.actorId,
  })
  if (!memberships.success) return memberships
  const repository = projectRepositoryCreate(options.database.db)
  const grants = repository.projectGrantList(options.project.id)
  if (!grants.success) return grants
  for (const membership of memberships.data.memberships) {
    if (membership.status !== "active") continue
    if (membership.organizationId === options.project.organizationId) {
      const ownerDecision = authorizationEnforce({
        actor: options.context.actor,
        realmId: options.realmId,
        organizationId: membership.organizationId,
        permission: options.permission,
        roles: membership.roles,
      })
      if (ownerDecision.success) return resultCreate({ roleKeys: [] })
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
      const roleKeys = projectRoleKeysRead(grant.roleKeys)
      if (!roleKeys.success) return roleKeys
      return resultCreate({ grantedOrganizationId: membership.organizationId, roleKeys: roleKeys.data })
    }
  }
  return resultErrorCreate(op, "The actor is not authorized for this project.")
}

function projectReadPermissionAllowed(permission: AuthorizationPermission): boolean {
  return permission === "project.read" || permission === "project.role.read" || permission === "project.app.read"
}

function projectRoleKeysRead(input: string): Result<string[]> {
  try {
    const parsed = JSON.parse(input) as unknown
    if (!Array.isArray(parsed) || parsed.some((key) => typeof key !== "string"))
      return resultErrorCreate("projectContextAuthorize", "The project grant is invalid.")
    return resultCreate(parsed)
  } catch (_error) {
    return resultErrorCreate("projectContextAuthorize", "The project grant is invalid.")
  }
}
