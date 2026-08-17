import { type Result } from "#result"
import { authorizationEnforce } from "../../authorization/public/authorizationEnforce.js"
import { authorizationPermissionDefinitions } from "../../authorization/public/authorizationPermissionDefinitions.js"
import type { AuthorizationPermission } from "../../authorization/public/authorizationPermissionSchema.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { organizationRolesDecode } from "../domain/organizationRolesDecode.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationRow } from "../persistence/organizationTable.js"

type OrganizationContextAuthorizeOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly organization: OrganizationRow
  readonly repository: ReturnType<typeof organizationRepositoryCreate>
  readonly requiredPermission?: AuthorizationPermission
  readonly requiredRole?: "member" | "admin"
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
  if (permission === undefined) return resultErrorCreate(op, "An authorization permission is required.")
  if (options.context.kind === "system") return resultCreate(undefined)
  if (options.context.instanceId !== options.organization.instanceId)
    return resultErrorCreate(op, "The organization is not available in this tenant context.")
  if (options.context.actor.kind === "bootstrap_admin")
    return authorizationEnforce({
      actor: options.context.actor,
      instanceId: options.organization.instanceId,
      organizationId: options.organization.id,
      permission,
    })
  const membership = options.repository.organizationMembershipGetByOrganizationUser(
    options.organization.id,
    options.context.actorId,
  )
  if (!membership.success) return membership
  if (membership.data === null) return resultErrorCreate(op, "The actor is not a member of this organization.")
  const roles = organizationRolesDecode(membership.data.roles)
  if (!roles.success) return roles
  return authorizationEnforce({
    actor: options.context.actor,
    instanceId: options.organization.instanceId,
    organizationId: options.organization.id,
    permission,
    roles: roles.data,
  })
}
