import { type Result } from "#result"
import { authorizationEnforce } from "../../authorization/actions/authorizationEnforce.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import type { AuthorizationPermission } from "../../authorization/public/authorizationPermissionSchema.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { organizationRolesDecode } from "../domain/organizationRolesDecode.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationMembershipRow } from "../persistence/organizationMembershipTable.js"
import type { OrganizationRow } from "../persistence/organizationTable.js"

type OrganizationContextAuthorizeOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly organization: OrganizationRow
  readonly repository: ReturnType<typeof organizationRepositoryCreate>
  readonly requiredPermission?: AuthorizationPermission
  readonly requiredRole?: "member" | "admin"
  readonly membership?: OrganizationMembershipRow | null
}

export function organizationContextAuthorize(options: OrganizationContextAuthorizeOptions): Result<void> {
  const op = "organizationContextAuthorize"
  const permission =
    options.requiredPermission ??
    (options.requiredRole === "admin"
      ? authorizationPermissionDefinitions.organizationManage
      : options.requiredRole === "member"
        ? authorizationPermissionDefinitions.organizationRead
        : undefined)
  if (permission === undefined)
    return resultErrorCodedCreate(op, "An authorization permission is required.", "organizations.invalid")
  if (options.context.kind === "system") return resultCreate(undefined)
  if (options.context.realmId !== options.organization.realmId)
    return resultErrorCodedCreate(
      op,
      "The organization is not available in this tenant context.",
      "organizations.tenant-mismatch",
    )
  if (options.context.actor.kind === "bootstrap_admin")
    return authorizationEnforce({
      actor: options.context.actor,
      realmId: options.organization.realmId,
      organizationId: options.organization.id,
      permission,
    })
  const membership =
    options.membership === undefined
      ? options.repository.organizationMembershipGetByOrganizationUser(options.organization.id, options.context.actorId)
      : resultCreate(options.membership)
  if (!membership.success) return membership
  if (membership.data === null)
    return resultErrorCodedCreate(op, "The actor is not a member of this organization.", "organizations.not-member")
  const roles = organizationRolesDecode(membership.data.roles)
  if (!roles.success) return roles
  return authorizationEnforce({
    actor: options.context.actor,
    realmId: options.organization.realmId,
    organizationId: options.organization.id,
    permission,
    roles: roles.data,
  })
}
