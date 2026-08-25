import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { passkeyRepositoryCreate } from "../persistence/passkeyRepositoryCreate.js"
import type { PasskeyUsableAuthenticationMethod } from "../public/passkeyUsableAuthenticationMethodSchema.js"

type PasskeyUsableAuthenticationMethodReadOptions = {
  readonly executor: StorageExecutor
  readonly realmId: string
  readonly userId: string
}

export function passkeyUsableAuthenticationMethodRead(
  options: PasskeyUsableAuthenticationMethodReadOptions,
): Result<PasskeyUsableAuthenticationMethod> {
  const credentials = passkeyRepositoryCreate(options.executor).passkeyCredentialList(options.realmId, options.userId)
  if (!credentials.success) return credentials
  return resultCreate({ available: credentials.data.some((credential) => credential.revokedAt === null) })
}
