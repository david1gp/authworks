import { and, eq, isNull, or } from "drizzle-orm"
import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmDomainNormalize } from "../../realms/domain/realmDomainNormalize.js"
import { organizationBrandingGet } from "./organizationBrandingGet.js"
import { organizationDomainRepositoryCreate } from "../persistence/organizationDomainRepositoryCreate.js"
import { organizationLoginPolicyResolve } from "./organizationLoginPolicyResolve.js"
import { organizationTable } from "../persistence/organizationTable.js"
import type { OrganizationDiscoveryResponse } from "../public/organizationDiscoveryResponseSchema.js"
import { externalIdentityProviderTable } from "../../externalIdentities/persistence/externalIdentityProviderTable.js"

type OrganizationDomainDiscoverOptions = {
  readonly database: StorageDatabase
  readonly domain: string
}

export function organizationDomainDiscover(
  options: OrganizationDomainDiscoverOptions,
): Result<OrganizationDiscoveryResponse> {
  const normalized = realmDomainNormalize(options.domain)
  if (!normalized.success) return resultCreate({ found: false })
  const domain = organizationDomainRepositoryCreate(options.database.db).organizationDomainGet(normalized.data)
  if (!domain.success || domain.data === null || !domain.data.verified) return resultCreate({ found: false })
  const organization = options.database.db
    .select({
      id: organizationTable.id,
      realmId: organizationTable.realmId,
      name: organizationTable.name,
      status: organizationTable.status,
    })
    .from(organizationTable)
    .where(
      and(eq(organizationTable.id, domain.data.organizationId), eq(organizationTable.realmId, domain.data.realmId)),
    )
    .get()
  if (organization === undefined || organization.status !== "active") return resultCreate({ found: false })
  const policy = organizationLoginPolicyResolve({
    database: options.database,
    realmId: domain.data.realmId,
    organizationId: organization.id,
  })
  if (!policy.success || !policy.data.allowDomainDiscovery) return resultCreate({ found: false })
  const branding = organizationBrandingGet({
    database: options.database,
    realmId: domain.data.realmId,
    organizationId: organization.id,
  })
  if (!branding.success) return resultCreate({ found: false })
  const providers = options.database.db
    .select({
      displayName: externalIdentityProviderTable.displayName,
      id: externalIdentityProviderTable.id,
      type: externalIdentityProviderTable.type,
    })
    .from(externalIdentityProviderTable)
    .where(
      and(
        eq(externalIdentityProviderTable.realmId, domain.data.realmId),
        eq(externalIdentityProviderTable.enabled, true),
        or(
          isNull(externalIdentityProviderTable.organizationId),
          eq(externalIdentityProviderTable.organizationId, organization.id),
        ),
      ),
    )
    .all()
    .filter((provider) => policy.data.providerIds === null || policy.data.providerIds.includes(provider.id))
    .filter((provider): provider is typeof provider & { type: "google" | "github" | "microsoft" } =>
      ["google", "github", "microsoft"].includes(provider.type),
    )
  return resultCreate({
    branding: branding.data.branding,
    domain: domain.data.domain,
    found: true,
    organization: { id: organization.id, realmId: organization.realmId, name: organization.name },
    policy: policy.data,
    providers,
  })
}
