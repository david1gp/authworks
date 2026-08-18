import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
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
}

export function organizationInvitationList(
  options: OrganizationInvitationListOptions,
): Result<{ invitations: OrganizationInvitation[] }> {
  const op = "organizationInvitationList"
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The invitations are not available in this tenant context.")
  const repository = organizationRepositoryCreate(options.database.db)
  const organization = repository.organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (
    organization.data === null ||
    organization.data.realmId !== options.realmId ||
    organization.data.status !== "active"
  )
    return resultErrorCreate(op, "The organization is not active or was not found.")
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
  return resultCreate({ invitations })
}
