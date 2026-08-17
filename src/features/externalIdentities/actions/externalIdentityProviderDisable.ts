import { type Result } from "#result"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { ExternalIdentityProvider } from "../public/externalIdentityProviderSchema.js"
import { externalIdentityProviderUpdate } from "./externalIdentityProviderUpdate.js"

type ExternalIdentityProviderDisableOptions = {
  readonly context: InstanceSystemContext
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly providerId: string
}

export function externalIdentityProviderDisable(
  options: ExternalIdentityProviderDisableOptions,
): Result<{ provider: ExternalIdentityProvider }> {
  return externalIdentityProviderUpdate({ ...options, input: { enabled: false } })
}
