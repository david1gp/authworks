import { type Result } from "#result"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationInvitationMeListResponse } from "../public/organizationInvitationMeListResponseSchema.js"
import { organizationInvitationViewsAssemble } from "../server/organizationInvitationViewsAssemble.js"
import { organizationSubjectUserGet } from "./organizationSubjectUserGet.js"

type OrganizationInvitationMeListOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly query?: ListQuery
}

export function organizationInvitationMeList(
  options: OrganizationInvitationMeListOptions,
): Result<OrganizationInvitationMeListResponse> {
  const subject = organizationSubjectUserGet(options)
  if (!subject.success) return subject
  const sortBy = listSortByResolve(options.query?.sortBy, ["createdAt", "id", "expiresAt"], "createdAt")
  if (!sortBy.success) return sortBy
  const rows = organizationRepositoryCreate(options.database.db).organizationInvitationListByRealmEmail(
    options.realmId,
    subject.data.email,
  )
  if (!rows.success) return rows
  const realmRows = rows.data.filter((row) => row.realmId === options.realmId)
  const views = organizationInvitationViewsAssemble({
    database: options.database,
    realmId: options.realmId,
    rows: realmRows,
  })
  if (!views.success) return views
  const invitations: OrganizationInvitationMeListResponse["items"] = views.data
  return listRowsPage({
    idGet: (invitation) => invitation.id,
    query: options.query,
    rows: invitations,
    sortValueGet: (invitation) => {
      if (sortBy.data === "id") return invitation.id
      if (sortBy.data === "expiresAt") return invitation.expiresAt
      return invitation.createdAt
    },
  })
}
