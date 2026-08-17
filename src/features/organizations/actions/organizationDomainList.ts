import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationDomainPublicViewCreate } from "../domain/organizationDomainPublicViewCreate.js"
import { organizationDomainRepositoryCreate } from "../persistence/organizationDomainRepositoryCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationDomainListResponse } from "../public/organizationDomainListResponseSchema.js"

type OrganizationDomainListOptions = {
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly organizationId: string
}

export function organizationDomainList(options: OrganizationDomainListOptions): Result<OrganizationDomainListResponse> {
  const organization = organizationRepositoryCreate(options.database.db).organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (
    organization.data === null ||
    organization.data.instanceId !== options.instanceId ||
    organization.data.status === "removed"
  )
    return resultErrorCreate("organizationDomainList", "The organization was not found.")
  const domains = organizationDomainRepositoryCreate(options.database.db).organizationDomainList(options.organizationId)
  if (!domains.success) return domains
  return resultCreate({ domains: domains.data.map(organizationDomainPublicViewCreate), total: domains.data.length })
}
