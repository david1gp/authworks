import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationRolesDecode } from "../domain/organizationRolesDecode.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"

type OrganizationMembershipAccessListOptions = {
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly userId: string
}

export function organizationMembershipAccessList(
  options: OrganizationMembershipAccessListOptions,
): Result<{ memberships: { organizationId: string; roles: string[]; status: string }[] }> {
  const op = "organizationMembershipAccessList"
  const repository = organizationRepositoryCreate(options.database.db)
  const organizations = repository.organizationList(options.instanceId)
  if (!organizations.success) return organizations
  const memberships: { organizationId: string; roles: string[]; status: string }[] = []
  for (const organization of organizations.data) {
    const membership = repository.organizationMembershipGetByOrganizationUser(organization.id, options.userId)
    if (!membership.success) return membership
    if (membership.data === null) continue
    const roles = organizationRolesDecode(membership.data.roles)
    if (!roles.success) return roles
    memberships.push({ organizationId: organization.id, roles: roles.data, status: organization.status })
  }
  return resultCreate({ memberships })
}
