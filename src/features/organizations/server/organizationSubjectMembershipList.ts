import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { organizationRolesDecode } from "../domain/organizationRolesDecode.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"

type OrganizationSubjectMembershipListOptions = {
  readonly executor: StorageExecutor
  readonly realmId: string
  readonly userId: string
}

export function organizationSubjectMembershipList(
  options: OrganizationSubjectMembershipListOptions,
): Result<{ organizationId: string; roles: string[] }[]> {
  const repository = organizationRepositoryCreate(options.executor)
  const memberships = repository.organizationMembershipListByRealmUser(options.realmId, options.userId)
  if (!memberships.success) return memberships
  const items: { organizationId: string; roles: string[] }[] = []
  for (const membership of memberships.data) {
    const organization = repository.organizationGet(membership.organizationId)
    if (!organization.success) return organization
    if (
      organization.data === null ||
      organization.data.realmId !== options.realmId ||
      organization.data.status !== "active"
    )
      continue
    const roles = organizationRolesDecode(membership.roles)
    if (!roles.success) return roles
    items.push({ organizationId: membership.organizationId, roles: roles.data })
  }
  items.sort((left, right) => left.organizationId.localeCompare(right.organizationId))
  return resultCreate(items)
}
