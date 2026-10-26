import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { passkeyCredentialViewCreate } from "../domain/passkeyCredentialViewCreate.js"
import { passkeyRepositoryCreate } from "../persistence/passkeyRepositoryCreate.js"
import type { PasskeyCredential } from "../public/passkeyCredentialSchema.js"

type PasskeyUserAuthenticationMethodsReadOptions = {
  readonly executor: StorageExecutor
  readonly realmId: string
  readonly userId: string
}

/** Reads the public passkey credential views for a realm-local user. */
export function passkeyUserAuthenticationMethodsRead(
  options: PasskeyUserAuthenticationMethodsReadOptions,
): Result<PasskeyCredential[]> {
  const credentials = passkeyRepositoryCreate(options.executor).passkeyCredentialList(options.realmId, options.userId)
  if (!credentials.success) return credentials
  return resultCreate(credentials.data.map(passkeyCredentialViewCreate))
}
