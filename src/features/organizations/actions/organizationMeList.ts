import { type Result } from "#result"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationMembershipPublicViewCreate } from "../domain/organizationMembershipPublicViewCreate.js"
import { organizationPublicViewCreate } from "../domain/organizationPublicViewCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationMeListResponse } from "../public/organizationMeListResponseSchema.js"
import { organizationSubjectUserGet } from "./organizationSubjectUserGet.js"

type OrganizationMeListOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly query?: ListQuery
}

export function organizationMeList(options: OrganizationMeListOptions): Result<OrganizationMeListResponse> {
  const subject = organizationSubjectUserGet(options)
  if (!subject.success) return subject
  const sortBy = listSortByResolve(options.query?.sortBy, ["createdAt", "id", "name"], "createdAt")
  if (!sortBy.success) return sortBy
  const repository = organizationRepositoryCreate(options.database.db)
  const memberships = repository.organizationMembershipListByRealmUser(options.realmId, subject.data.userId)
  if (!memberships.success) return memberships
  const items: OrganizationMeListResponse["items"] = []
  for (const membership of memberships.data) {
    const organization = repository.organizationGet(membership.organizationId)
    if (!organization.success) return organization
    if (
      organization.data === null ||
      organization.data.realmId !== options.realmId ||
      membership.realmId !== options.realmId ||
      organization.data.status !== "active"
    )
      continue
    const membershipView = organizationMembershipPublicViewCreate(membership)
    if (!membershipView.success) return membershipView
    items.push({
      membership: membershipView.data,
      organization: organizationPublicViewCreate(organization.data),
    })
  }
  const page = listRowsPage({
    idGet: (item) => item.organization.id,
    query: options.query,
    rows: items,
    sortValueGet: (item) => {
      if (sortBy.data === "id") return item.organization.id
      if (sortBy.data === "name") return item.organization.name
      return item.organization.createdAt
    },
  })
  return page
}
