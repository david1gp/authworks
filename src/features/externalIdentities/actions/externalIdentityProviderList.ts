import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { externalIdentityProviderViewCreate } from "../domain/externalIdentityProviderViewCreate.js"
import { externalIdentityRepositoryCreate } from "../persistence/externalIdentityRepositoryCreate.js"
import type { ExternalIdentityProviderListResponse } from "../public/externalIdentityProviderListResponseSchema.js"
import { organizationLoginPolicyResolve } from "../../organizations/public/organizationLoginPolicyResolve.js"

type ExternalIdentityProviderListOptions = {
  readonly database: StorageDatabase
  readonly includeDisabled?: boolean
  readonly realmId: string
  readonly organizationId?: string
}

export function externalIdentityProviderList(
  options: ExternalIdentityProviderListOptions,
): Result<ExternalIdentityProviderListResponse> {
  const repository = externalIdentityRepositoryCreate(options.database.db)
  const realmProviders = repository.externalIdentityProviderList(options.realmId)
  if (!realmProviders.success) return realmProviders
  const organizationProviders =
    options.organizationId === undefined
      ? resultCreate<typeof realmProviders.data>([])
      : repository.externalIdentityProviderList(options.realmId, options.organizationId)
  if (!organizationProviders.success) return organizationProviders
  const policy = organizationLoginPolicyResolve({
    database: options.database,
    realmId: options.realmId,
    organizationId: options.organizationId,
  })
  if (!policy.success) return policy
  const providerIds = policy.data.providerIds
  const providers = [...realmProviders.data, ...organizationProviders.data].filter(
    (provider, index, all) => all.findIndex((candidate) => candidate.id === provider.id) === index,
  )
  const visible = providers.filter(
    (provider) =>
      (options.includeDisabled === true || provider.enabled) &&
      (providerIds === null || providerIds.includes(provider.id)),
  )
  return resultCreate({ providers: visible.map(externalIdentityProviderViewCreate), total: visible.length })
}
