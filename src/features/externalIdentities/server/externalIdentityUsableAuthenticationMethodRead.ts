import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { externalIdentityRepositoryCreate } from "../persistence/externalIdentityRepositoryCreate.js"
import type { ExternalIdentityUsableAuthenticationMethod } from "../public/externalIdentityUsableAuthenticationMethodSchema.js"

type ExternalIdentityUsableAuthenticationMethodReadOptions = {
  readonly executor: StorageExecutor
  readonly realmId: string
  readonly userId: string
}

export function externalIdentityUsableAuthenticationMethodRead(
  options: ExternalIdentityUsableAuthenticationMethodReadOptions,
): Result<ExternalIdentityUsableAuthenticationMethod> {
  const identities = externalIdentityRepositoryCreate(options.executor).externalIdentityList(
    options.realmId,
    options.userId,
  )
  if (!identities.success) return identities
  return resultCreate({ available: identities.data.length > 0 })
}
