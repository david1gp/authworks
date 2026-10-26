import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationMetadataRepositoryCreate } from "../persistence/organizationMetadataRepositoryCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import { organizationMetadataKeySchema } from "../public/organizationMetadataKeySchema.js"
import type { OrganizationMetadata } from "../public/organizationMetadataSchema.js"
import { organizationMetadataAuthorize } from "./organizationMetadataAuthorize.js"

type OrganizationMetadataGetOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly key: string
  readonly organizationId: string
  readonly realmId: string
}

export function organizationMetadataGet(
  options: OrganizationMetadataGetOptions,
): Result<{ metadata: OrganizationMetadata }> {
  const op = "organizationMetadataGet"
  if (!v.safeParse(organizationMetadataKeySchema, options.key).success)
    return resultErrorCodedCreate(op, "The metadata key is invalid.", "organizations.invalid")
  const organizations = organizationRepositoryCreate(options.database.db)
  const organization = organizations.organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (
    organization.data === null ||
    organization.data.realmId !== options.realmId ||
    organization.data.status === "removed"
  )
    return resultErrorCodedCreate(op, "The organization was not found.", "organizations.not-found")
  if (options.context.kind === "tenant" && organization.data.status !== "active")
    return resultErrorCodedCreate(op, "The organization is not active.", "organizations.not-active")
  const authorized = organizationMetadataAuthorize({
    context: options.context,
    database: options.database,
    organization: organization.data,
    repository: organizations,
    requiredPermission: "organization.read",
  })
  if (!authorized.success) return authorized
  const entry = organizationMetadataRepositoryCreate(options.database.db).organizationMetadataGet(
    options.realmId,
    options.organizationId,
    options.key,
  )
  if (!entry.success) return entry
  if (entry.data === null)
    return resultErrorCodedCreate(op, "The organization metadata was not found.", "organizations.not-found")
  return resultCreate({
    metadata: {
      createdAt: entry.data.createdAt,
      key: entry.data.key,
      organizationId: entry.data.organizationId,
      updatedAt: entry.data.updatedAt,
      value: entry.data.value,
      version: entry.data.version,
    },
  })
}
