import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { externalIdentityProviderViewCreate } from "../domain/externalIdentityProviderViewCreate.js"
import { externalIdentityRepositoryCreate } from "../persistence/externalIdentityRepositoryCreate.js"
import type { ExternalIdentityProviderListResponse } from "../public/externalIdentityProviderListResponseSchema.js"

type ExternalIdentityProviderListOptions = {
  readonly database: StorageDatabase
  readonly includeDisabled?: boolean
  readonly instanceId: string
  readonly organizationId?: string
}

export function externalIdentityProviderList(
  options: ExternalIdentityProviderListOptions,
): Result<ExternalIdentityProviderListResponse> {
  const providers = externalIdentityRepositoryCreate(options.database.db).externalIdentityProviderList(
    options.instanceId,
    options.organizationId,
  )
  if (!providers.success) return providers
  const visible = providers.data.filter((provider) => options.includeDisabled === true || provider.enabled)
  return resultCreate({ providers: visible.map(externalIdentityProviderViewCreate), total: visible.length })
}
