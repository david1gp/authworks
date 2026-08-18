import { type Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { organizationDomainPublicViewCreate } from "../domain/organizationDomainPublicViewCreate.js"
import { organizationDomainRepositoryCreate } from "../persistence/organizationDomainRepositoryCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationDomainListResponse } from "../public/organizationDomainListResponseSchema.js"

type OrganizationDomainListOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly organizationId: string
  readonly query?: ListQuery
}

export function organizationDomainList(options: OrganizationDomainListOptions): Result<OrganizationDomainListResponse> {
  const organization = organizationRepositoryCreate(options.database.db).organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (
    organization.data === null ||
    organization.data.realmId !== options.realmId ||
    organization.data.status === "removed"
  )
    return resultErrorCodedCreate(
      "organizationDomainList",
      "The organization was not found.",
      "organizations.not-found",
    )
  const sortBy = listSortByResolve(options.query?.sortBy, ["createdAt", "domain", "id"], "createdAt")
  if (!sortBy.success) return sortBy
  const domains = organizationDomainRepositoryCreate(options.database.db).organizationDomainList(options.organizationId)
  if (!domains.success) return domains
  const items = domains.data.map(organizationDomainPublicViewCreate)
  return listRowsPage({
    idGet: (domain) => domain.domain,
    query: options.query,
    rows: items,
    sortValueGet: (domain) => (sortBy.data === "createdAt" ? domain.createdAt : domain.domain),
  })
}
