import { type Result } from "#result"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { ExternalIdentityProvider } from "../public/externalIdentityProviderSchema.js"
import { externalIdentityProviderUpdate } from "./externalIdentityProviderUpdate.js"

type ExternalIdentityProviderDisableOptions = {
  readonly context: RealmSystemContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly providerId: string
}

export function externalIdentityProviderDisable(
  options: ExternalIdentityProviderDisableOptions,
): Result<{ provider: ExternalIdentityProvider }> {
  return externalIdentityProviderUpdate({ ...options, input: { enabled: false } })
}
