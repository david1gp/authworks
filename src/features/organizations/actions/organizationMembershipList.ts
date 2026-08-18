import { type Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationMembershipPublicViewCreate } from "../domain/organizationMembershipPublicViewCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationMembershipListResponse } from "../public/organizationMembershipListResponseSchema.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationMembershipListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly organizationId: string
  readonly query?: ListQuery
}

export function organizationMembershipList(
  options: OrganizationMembershipListOptions,
): Result<OrganizationMembershipListResponse> {
  const op = "organizationMembershipList"
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The memberships are not available in this tenant context.",
      "organizations.tenant-mismatch",
    )
  const repository = organizationRepositoryCreate(options.database.db)
  const organization = repository.organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (
    organization.data === null ||
    organization.data.realmId !== options.realmId ||
    organization.data.status !== "active"
  )
    return resultErrorCodedCreate(op, "The organization is not active or was not found.", "organizations.not-found")
  const authorized = organizationContextAuthorize({
    context: options.context,
    organization: organization.data,
    repository,
    requiredPermission: "organization.read",
  })
  if (!authorized.success) return authorized
  const rows = repository.organizationMembershipList(options.organizationId)
  if (!rows.success) return rows
  const memberships: OrganizationMembershipListResponse["items"] = []
  for (const row of rows.data) {
    const view = organizationMembershipPublicViewCreate(row)
    if (!view.success) return view
    memberships.push(view.data)
  }
  const sortBy = listSortByResolve(options.query?.sortBy, ["createdAt", "id", "userId"], "createdAt")
  if (!sortBy.success) return sortBy
  return listRowsPage({
    idGet: (membership) => membership.id,
    query: options.query,
    rows: memberships,
    sortValueGet: (membership) => {
      if (sortBy.data === "id") return membership.id
      if (sortBy.data === "userId") return membership.userId
      return membership.createdAt
    },
  })
}
