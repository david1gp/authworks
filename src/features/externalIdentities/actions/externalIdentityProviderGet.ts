import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { externalIdentityProviderViewCreate } from "../domain/externalIdentityProviderViewCreate.js"
import { externalIdentityRepositoryCreate } from "../persistence/externalIdentityRepositoryCreate.js"
import type { ExternalIdentityProvider } from "../public/externalIdentityProviderSchema.js"

type ExternalIdentityProviderGetOptions = {
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly providerId: string
  readonly includeDisabled?: boolean
}

export function externalIdentityProviderGet(
  options: ExternalIdentityProviderGetOptions,
): Result<{ provider: ExternalIdentityProvider }> {
  const provider = externalIdentityRepositoryCreate(options.database.db).externalIdentityProviderGet(
    options.instanceId,
    options.providerId,
  )
  if (!provider.success) return provider
  if (provider.data === null || (!options.includeDisabled && !provider.data.enabled))
    return resultErrorCreate("externalIdentityProviderGet", "The external identity provider was not found.")
  return resultCreate({ provider: externalIdentityProviderViewCreate(provider.data) })
}
