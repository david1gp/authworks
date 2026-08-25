import { type Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { authorizationRoleKeysResolve } from "../../authorization/actions/authorizationRoleKeysResolve.js"
import { organizationPublicViewCreate } from "../domain/organizationPublicViewCreate.js"
import { organizationRolesDecode } from "../domain/organizationRolesDecode.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationAccountAccessListResponse } from "../public/organizationAccountAccessListResponseSchema.js"

type OrganizationAccountAccessListOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
}

export function organizationAccountAccessList(
  options: OrganizationAccountAccessListOptions,
): Result<OrganizationAccountAccessListResponse> {
  const op = "organizationAccountAccessList"
  if (options.realmId.length === 0 || options.userId.length === 0)
    return resultErrorCodedCreate(op, "The account access context is invalid.", "organizations.invalid")
  const repository = organizationRepositoryCreate(options.database.db)
  const memberships = repository.organizationMembershipListByRealmUser(options.realmId, options.userId)
  if (!memberships.success) return memberships

  const items: OrganizationAccountAccessListResponse["items"] = []
  const seenOrganizationIds = new Set<string>()
  for (const membership of memberships.data) {
    if (seenOrganizationIds.has(membership.organizationId)) continue
    const organization = repository.organizationGet(membership.organizationId)
    if (!organization.success) return organization
    if (
      organization.data === null ||
      organization.data.realmId !== options.realmId ||
      membership.realmId !== options.realmId ||
      membership.userId !== options.userId ||
      organization.data.status !== "active"
    )
      continue
    const roles = organizationRolesDecode(membership.roles)
    if (!roles.success) return roles
    const resolved = authorizationRoleKeysResolve({ roles: roles.data })
    if (!resolved.success) return resolved
    seenOrganizationIds.add(membership.organizationId)
    items.push({
      membership: {
        createdAt: membership.createdAt,
        id: membership.id,
        organizationId: membership.organizationId,
        realmId: membership.realmId,
        roles: resolved.data.roleKeys,
        updatedAt: membership.updatedAt,
        userId: membership.userId,
      },
      organization: organizationPublicViewCreate(organization.data),
    })
  }
  items.sort((left, right) => left.organization.id.localeCompare(right.organization.id))
  return { data: { items }, success: true }
}
