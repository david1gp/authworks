import { type Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationInvitationPublicViewCreate } from "../domain/organizationInvitationPublicViewCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationInvitation } from "../public/organizationInvitationSchema.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationInvitationListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly organizationId: string
  readonly query?: ListQuery
}

export function organizationInvitationList(
  options: OrganizationInvitationListOptions,
): Result<{ items: OrganizationInvitation[]; nextPageToken?: string }> {
  const op = "organizationInvitationList"
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The invitations are not available in this tenant context.",
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
  const rows = repository.organizationInvitationList(options.organizationId)
  if (!rows.success) return rows
  const invitations: OrganizationInvitation[] = []
  for (const row of rows.data) {
    const view = organizationInvitationPublicViewCreate(row)
    if (!view.success) return view
    invitations.push(view.data)
  }
  const sortBy = listSortByResolve(options.query?.sortBy, ["createdAt", "id", "email", "status"], "createdAt")
  if (!sortBy.success) return sortBy
  return listRowsPage({
    idGet: (invitation) => invitation.id,
    query: options.query,
    rows: invitations,
    sortValueGet: (invitation) => {
      if (sortBy.data === "id") return invitation.id
      if (sortBy.data === "email") return invitation.email
      if (sortBy.data === "status") return invitation.status
      return invitation.createdAt
    },
  })
}
