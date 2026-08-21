import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationPublicViewCreate } from "../domain/organizationPublicViewCreate.js"
import type { OrganizationMembershipRow } from "../persistence/organizationMembershipTable.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationListResponse } from "../public/organizationListResponseSchema.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly query?: ListQuery
}

export function organizationList(options: OrganizationListOptions): Result<OrganizationListResponse> {
  const op = "organizationList"
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The organizations are not available in this tenant context.",
      "organizations.tenant-mismatch",
    )
  const sortBy = listSortByResolve(options.query?.sortBy, ["createdAt", "id", "name", "status"], "createdAt")
  if (!sortBy.success) return sortBy
  const repository = organizationRepositoryCreate(options.database.db)
  const rows = repository.organizationList(options.realmId)
  if (!rows.success) return rows
  const membershipsByOrganization = new Map<string, OrganizationMembershipRow>()
  if (options.context.kind === "tenant" && options.context.actor.kind !== "bootstrap_admin") {
    const memberships = repository.organizationMembershipListByRealmUser(options.realmId, options.context.actorId)
    if (!memberships.success) return memberships
    for (const membership of memberships.data) membershipsByOrganization.set(membership.organizationId, membership)
  }
  const organizations = [] as OrganizationListResponse["items"]
  for (const row of rows.data) {
    if (row.status === "removed") continue
    if (options.context.kind === "tenant" && row.status !== "active") continue
    if (options.context.kind === "tenant") {
      const authorized = organizationContextAuthorize({
        context: options.context,
        organization: row,
        repository,
        membership:
          options.context.kind === "tenant" && options.context.actor.kind !== "bootstrap_admin"
            ? (membershipsByOrganization.get(row.id) ?? null)
            : undefined,
        requiredPermission: "organization.read",
      })
      if (!authorized.success) continue
    }
    organizations.push(organizationPublicViewCreate(row))
  }
  const page = listRowsPage({
    idGet: (organization) => organization.id,
    query: options.query,
    rows: organizations,
    sortValueGet: (organization) => {
      if (sortBy.data === "id") return organization.id
      if (sortBy.data === "name") return organization.name
      if (sortBy.data === "status") return organization.status
      return organization.createdAt
    },
  })
  if (!page.success) return page
  return resultCreate(page.data)
}
