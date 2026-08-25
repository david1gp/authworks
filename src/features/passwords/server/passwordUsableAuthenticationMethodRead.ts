import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageExecutor } from "../../../platform/storage/storageSchema.js"
import { passwordRepositoryCreate } from "../persistence/passwordRepositoryCreate.js"
import type { PasswordUsableAuthenticationMethod } from "../public/passwordUsableAuthenticationMethodSchema.js"

type PasswordUsableAuthenticationMethodReadOptions = {
  readonly executor: StorageExecutor
  readonly realmId: string
  readonly userId: string
}

export function passwordUsableAuthenticationMethodRead(
  options: PasswordUsableAuthenticationMethodReadOptions,
): Result<PasswordUsableAuthenticationMethod> {
  const credential = passwordRepositoryCreate(options.executor).passwordCredentialGet(options.realmId, options.userId)
  if (!credential.success) return credential
  return resultCreate({ available: credential.data !== null })
}
