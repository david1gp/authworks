import { type Result } from "#result"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationRolesDecode } from "../domain/organizationRolesDecode.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"

type OrganizationMembershipAccessListOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
  readonly query?: ListQuery
}

export function organizationMembershipAccessList(
  options: OrganizationMembershipAccessListOptions,
): Result<{ items: { organizationId: string; roles: string[]; status: string }[]; nextPageToken?: string }> {
  const repository = organizationRepositoryCreate(options.database.db)
  const organizations = repository.organizationList(options.realmId)
  if (!organizations.success) return organizations
  const memberships = repository.organizationMembershipListByRealmUser(options.realmId, options.userId)
  if (!memberships.success) return memberships
  const organizationsById = new Map(organizations.data.map((organization) => [organization.id, organization]))
  const items: { organizationId: string; roles: string[]; status: string }[] = []
  for (const membership of memberships.data) {
    const organization = organizationsById.get(membership.organizationId)
    if (organization === undefined) continue
    const roles = organizationRolesDecode(membership.roles)
    if (!roles.success) return roles
    items.push({ organizationId: organization.id, roles: roles.data, status: organization.status })
  }
  const sortBy = listSortByResolve(options.query?.sortBy, ["createdAt", "id"], "createdAt")
  if (!sortBy.success) return sortBy
  return listRowsPage({
    idGet: (membership) => membership.organizationId,
    query: options.query,
    rows: items,
    sortValueGet: (membership) => {
      if (sortBy.data === "id") return membership.organizationId
      return organizationsById.get(membership.organizationId)?.createdAt ?? 0
    },
  })
}
