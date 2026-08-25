import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"

type OrganizationAccountAccessActiveIdListOptions = {
  readonly database: StorageDatabase
  readonly organizationIds: readonly string[]
  readonly realmId: string
}

export function organizationAccountAccessActiveIdList(
  options: OrganizationAccountAccessActiveIdListOptions,
): Result<string[]> {
  const op = "organizationAccountAccessActiveIdList"
  if (options.realmId.length === 0 || options.organizationIds.some((organizationId) => organizationId.length === 0))
    return resultErrorCodedCreate(op, "The organization access context is invalid.", "organizations.invalid")
  const repository = organizationRepositoryCreate(options.database.db)
  const activeIds = new Set<string>()
  for (const organizationId of options.organizationIds) {
    if (activeIds.has(organizationId)) continue
    const organization = repository.organizationGet(organizationId)
    if (!organization.success) return organization
    if (organization.data?.realmId !== options.realmId || organization.data.status !== "active") continue
    activeIds.add(organizationId)
  }
  return resultCreate([...activeIds].sort())
}
