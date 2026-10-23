import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import type { OrganizationMembershipRow } from "../persistence/organizationMembershipTable.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"

type OrganizationMembershipListByOrganizationOptions = {
  readonly database: StorageDatabase | StorageExecutor
  readonly realmId: string
  readonly organizationIds: readonly string[]
  readonly userIds?: readonly string[]
}

export function organizationMembershipListByOrganization(
  options: OrganizationMembershipListByOrganizationOptions,
): Result<OrganizationMembershipRow[]> {
  const op = "organizationMembershipListByOrganization"
  if (options.realmId.length === 0)
    return resultErrorCodedCreate(op, "The membership lookup is invalid.", "organizations.invalid")
  const executor = (
    "db" in options.database ? (options.database as StorageDatabase).db : options.database
  ) as StorageExecutor
  const repository = organizationRepositoryCreate(executor)
  const userFilter = options.userIds === undefined ? undefined : new Set(options.userIds)
  const rows: OrganizationMembershipRow[] = []
  for (const organizationId of new Set(options.organizationIds)) {
    if (organizationId.length === 0) continue
    const page = repository.organizationMembershipList(organizationId)
    if (!page.success) return page
    for (const row of page.data) {
      if (row.realmId !== options.realmId) continue
      if (userFilter !== undefined && !userFilter.has(row.userId)) continue
      rows.push(row)
    }
  }
  return resultCreate(rows)
}
