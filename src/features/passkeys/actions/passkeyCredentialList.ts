import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { passkeyCredentialViewCreate } from "../domain/passkeyCredentialViewCreate.js"
import { passkeyRepositoryCreate } from "../persistence/passkeyRepositoryCreate.js"
import type { PasskeyCredentialListResponse } from "../public/passkeyCredentialListResponseSchema.js"

type PasskeyCredentialListOptions = {
  readonly database: StorageDatabase
  readonly instanceId: string
  readonly userId: string
}

export function passkeyCredentialList(options: PasskeyCredentialListOptions): Result<PasskeyCredentialListResponse> {
  const credentials = passkeyRepositoryCreate(options.database.db).passkeyCredentialList(
    options.instanceId,
    options.userId,
  )
  if (!credentials.success) return credentials
  return resultCreate({ credentials: credentials.data.map(passkeyCredentialViewCreate) })
}
