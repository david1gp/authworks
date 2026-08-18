import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationPublicViewCreate } from "../domain/organizationPublicViewCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { Organization } from "../public/organizationSchema.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationGetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly organizationId: string
}

export function organizationGet(options: OrganizationGetOptions): Result<{ organization: Organization }> {
  const op = "organizationGet"
  if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
    return resultErrorCreate(op, "The organization is not available in this tenant context.")
  const repository = organizationRepositoryCreate(options.database.db)
  const organization = repository.organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (organization.data === null || organization.data.realmId !== options.realmId)
    return resultErrorCreate(op, "The organization was not found.")
  if (organization.data.status === "removed") return resultErrorCreate(op, "The organization was not found.")
  if (options.context.kind === "tenant" && organization.data.status !== "active")
    return resultErrorCreate(op, "The organization is not active.")
  const authorized = organizationContextAuthorize({
    context: options.context,
    organization: organization.data,
    repository,
    requiredPermission: "organization.read",
  })
  if (!authorized.success) return authorized
  return resultCreate({ organization: organizationPublicViewCreate(organization.data) })
}
