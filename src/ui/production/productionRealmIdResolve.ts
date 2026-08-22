import { organizationApiClientCreate } from "../../features/organizations/client/organizationApiClientCreate.js"

export async function productionRealmIdResolve(options: {
  readonly baseUrl: string
  readonly domain: string
  readonly fallbackRealmId: string
}): Promise<string> {
  const discovered = await organizationApiClientCreate({ baseUrl: options.baseUrl }).organizationTenantDomainDiscover(
    options.domain,
  )
  if (!discovered.success || !discovered.data.found) return options.fallbackRealmId
  return discovered.data.organization.realmId
}
