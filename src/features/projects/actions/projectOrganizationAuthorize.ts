import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationEnforce } from "../../authorization/actions/authorizationEnforce.js"
import type { AuthorizationPermission } from "../../authorization/public/authorizationPermissionSchema.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationMembershipAccessList } from "../../organizations/actions/organizationMembershipAccessList.js"

type ProjectOrganizationAuthorizeOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly organizationId: string
  readonly permission: AuthorizationPermission
}

export function projectOrganizationAuthorize(options: ProjectOrganizationAuthorizeOptions): Result<void> {
  const op = "projectOrganizationAuthorize"
  if (options.context.kind === "system") return resultCreate(undefined)
  if (options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The project is not available in this tenant context.",
      "projects.tenant-mismatch",
    )
  if (options.context.actor.kind === "bootstrap_admin")
    return authorizationEnforce({
      actor: options.context.actor,
      realmId: options.realmId,
      organizationId: options.organizationId,
      permission: options.permission,
    })
  const memberships = organizationMembershipAccessList({
    database: options.database,
    realmId: options.realmId,
    userId: options.context.actorId,
  })
  if (!memberships.success) return memberships
  const membership = memberships.data.items.find(
    (candidate) => candidate.organizationId === options.organizationId && candidate.status === "active",
  )
  if (membership === undefined)
    return resultErrorCodedCreate(op, "The actor is not a member of this organization.", "projects.membership-required")
  return authorizationEnforce({
    actor: options.context.actor,
    realmId: options.realmId,
    organizationId: options.organizationId,
    permission: options.permission,
    roles: membership.roles,
  })
}
