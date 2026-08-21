import * as v from "valibot"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { organizationBrandingDefaultCreate } from "../domain/organizationBrandingDefaultCreate.js"
import { organizationBrandingRepositoryCreate } from "../persistence/organizationBrandingRepositoryCreate.js"
import { organizationRepositoryCreate } from "../persistence/organizationRepositoryCreate.js"
import type { OrganizationBrandingResponse } from "../public/organizationBrandingResponseSchema.js"
import { organizationBrandingSchema } from "../public/organizationBrandingSchema.js"
import { organizationContextAuthorize } from "./organizationContextAuthorize.js"

type OrganizationBrandingGetOptions = {
  readonly context?: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly organizationId: string
}

export function organizationBrandingGet(options: OrganizationBrandingGetOptions): Result<OrganizationBrandingResponse> {
  const organization = organizationRepositoryCreate(options.database.db).organizationGet(options.organizationId)
  if (!organization.success) return organization
  if (
    organization.data === null ||
    organization.data.realmId !== options.realmId ||
    organization.data.status !== "active"
  )
    return resultErrorCodedCreate(
      "organizationBrandingGet",
      "The organization was not found.",
      "organizations.not-found",
    )
  if (options.context !== undefined) {
    if (options.context.kind === "tenant" && options.context.realmId !== options.realmId)
      return resultErrorCodedCreate(
        "organizationBrandingGet",
        "The organization is not available in this tenant context.",
        "organizations.tenant-mismatch",
      )
    const authorized = organizationContextAuthorize({
      context: options.context,
      organization: organization.data,
      repository: organizationRepositoryCreate(options.database.db),
      requiredPermission: "organization.read",
    })
    if (!authorized.success) return authorized
  }
  const branding = organizationBrandingRepositoryCreate(options.database.db).organizationBrandingGet(
    options.organizationId,
  )
  if (!branding.success) return branding
  if (branding.data === null) {
    return resultCreate({
      branding: organizationBrandingDefaultCreate(),
      organizationId: options.organizationId,
      updatedAt: organization.data.updatedAt,
      version: 1,
    })
  }
  try {
    const parsed = JSON.parse(branding.data.branding) as unknown
    const checked = v.safeParse(organizationBrandingSchema, parsed)
    if (!checked.success)
      return resultErrorCodedCreate(
        "organizationBrandingGet",
        "The organization branding is invalid.",
        "organizations.event-invalid",
      )
    return resultCreate({
      branding: checked.output,
      organizationId: options.organizationId,
      updatedAt: branding.data.updatedAt,
      version: branding.data.version,
    })
  } catch (_error) {
    return resultErrorCodedCreate(
      "organizationBrandingGet",
      "The organization branding is invalid.",
      "organizations.event-invalid",
    )
  }
}
