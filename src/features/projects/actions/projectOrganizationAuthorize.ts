import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationEnforce } from "../../authorization/public/authorizationEnforce.js"
import type { AuthorizationPermission } from "../../authorization/public/authorizationPermissionSchema.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { organizationMembershipAccessList } from "../../organizations/actions/organizationMembershipAccessList.js"

type ProjectOrganizationAuthorizeOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly organizationId: string
  readonly permission: AuthorizationPermission
}

export function projectOrganizationAuthorize(options: ProjectOrganizationAuthorizeOptions): Result<void> {
  const op = "projectOrganizationAuthorize"
  if (options.context.kind === "system") return resultCreate(undefined)
  if (options.context.instanceId !== options.instanceId)
    return resultErrorCreate(op, "The project is not available in this tenant context.")
  if (options.context.actor.kind === "bootstrap_admin")
    return authorizationEnforce({
      actor: options.context.actor,
      instanceId: options.instanceId,
      organizationId: options.organizationId,
      permission: options.permission,
    })
  const memberships = organizationMembershipAccessList({
    database: options.database,
    instanceId: options.instanceId,
    userId: options.context.actorId,
  })
  if (!memberships.success) return memberships
  const membership = memberships.data.memberships.find(
    (candidate) => candidate.organizationId === options.organizationId && candidate.status === "active",
  )
  if (membership === undefined) return resultErrorCreate(op, "The actor is not a member of this organization.")
  return authorizationEnforce({
    actor: options.context.actor,
    instanceId: options.instanceId,
    organizationId: options.organizationId,
    permission: options.permission,
    roles: membership.roles,
  })
}
