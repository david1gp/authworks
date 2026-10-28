import type { Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationContextAuthorize } from "../actions/organizationContextAuthorize.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"

type OrganizationActivityAuthorizeOptions = {
  readonly context: RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly organizationId: string
}

/** Authorize administrative activity access without exposing organization persistence rows. */
export function organizationActivityAuthorize(options: OrganizationActivityAuthorizeOptions): Result<void> {
  const op = "organizationActivityAuthorize"
  if (options.context.realmId !== options.realmId)
    return resultErrorCodedCreate(
      op,
      "The organization is not available in this tenant context.",
      "organizations.tenant-mismatch",
    )
  const repository = organizationRepositoryCreate(options.database.db)
  const organization = repository.organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (
    organization.data === null ||
    organization.data.realmId !== options.realmId ||
    organization.data.status === "removed"
  )
    return resultErrorCodedCreate(op, "The organization was not found.", "organizations.not-found")
  if (organization.data.status !== "active")
    return resultErrorCodedCreate(op, "The organization is not active.", "organizations.not-active")
  return organizationContextAuthorize({
    context: options.context,
    database: options.database,
    organization: organization.data,
    repository,
    requiredPermission: "organization.members.manage",
  })
}
