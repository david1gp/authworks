import * as v from "valibot"
import { type Result } from "#result"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationMetadataRepositoryCreate } from "../persistence/organizationMetadataRepositoryCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationMetadataListQuery } from "../public/organizationMetadataListQuerySchema.js"
import { organizationMetadataListQuerySchema } from "../public/organizationMetadataListQuerySchema.js"
import type { OrganizationMetadataListResponse } from "../public/organizationMetadataListResponseSchema.js"
import type { OrganizationMetadata } from "../public/organizationMetadataSchema.js"
import { organizationMetadataAuthorize } from "./organizationMetadataAuthorize.js"

type OrganizationMetadataListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly organizationId: string
  readonly query?: OrganizationMetadataListQuery
  readonly realmId: string
}

export function organizationMetadataList(
  options: OrganizationMetadataListOptions,
): Result<OrganizationMetadataListResponse> {
  const op = "organizationMetadataList"
  const parsed = v.safeParse(organizationMetadataListQuerySchema, options.query ?? {})
  if (!parsed.success) return resultErrorCodedCreate(op, "The metadata list query is invalid.", "organizations.invalid")
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
  const entries = organizationMetadataRepositoryCreate(options.database.db).organizationMetadataList(
    options.realmId,
    options.organizationId,
  )
  if (!entries.success) return entries
  const prefix = parsed.output.keyPrefix
  const rows: OrganizationMetadata[] = entries.data
    .filter((entry) => prefix === undefined || entry.key.startsWith(prefix))
    .map((entry) => ({
      createdAt: entry.createdAt,
      key: entry.key,
      organizationId: entry.organizationId,
      updatedAt: entry.updatedAt,
      value: entry.value,
      version: entry.version,
    }))
  return listRowsPage({
    idGet: (entry) => entry.key,
    query: parsed.output,
    rows,
    sortValueGet: (entry) => entry.key,
  })
}
