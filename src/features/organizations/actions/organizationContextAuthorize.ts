import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { organizationRoleAccessCheck } from "../domain/organizationRoleAccessCheck.js"
import { organizationRolesDecode } from "../domain/organizationRolesDecode.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationRow } from "../persistence/organizationTable.js"

type OrganizationContextAuthorizeOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly organization: OrganizationRow
  readonly repository: ReturnType<typeof organizationRepositoryCreate>
  readonly requiredRole: "member" | "admin"
}

export function organizationContextAuthorize(options: OrganizationContextAuthorizeOptions): Result<void> {
  const op = "organizationContextAuthorize"
  if (options.context.kind === "system") return resultCreate(undefined)
  if (options.context.instanceId !== options.organization.instanceId)
    return resultErrorCreate(op, "The organization is not available in this tenant context.")
  const membership = options.repository.organizationMembershipGetByOrganizationUser(
    options.organization.id,
    options.context.actorId,
  )
  if (!membership.success) return membership
  if (membership.data === null) return resultErrorCreate(op, "The actor is not a member of this organization.")
  const roles = organizationRolesDecode(membership.data.roles)
  if (!roles.success) return roles
  return organizationRoleAccessCheck(roles.data, options.requiredRole)
}
