import { type Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationDomainPublicViewCreate } from "../domain/organizationDomainPublicViewCreate.js"
import { organizationDomainRepositoryCreate } from "../persistence/organizationDomainRepositoryCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationDomainListResponse } from "../public/organizationDomainListResponseSchema.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationDomainListOptions = {
  readonly context?: RealmSystemContext | RealmTenantContext
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
  if (options.context !== undefined) {
    if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
      return resultErrorCodedCreate(
        "organizationDomainList",
        "The organization is not available in this tenant context.",
        "organizations.tenant-mismatch",
      )
    const authorized = organizationContextAuthorize({
      context: options.context,
      organization: organization.data,
      repository: organizationRepositoryCreate(options.database.db),
      requiredPermission: "organization.read",
    })
    if (!authorized.success) return authorized
  }
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
