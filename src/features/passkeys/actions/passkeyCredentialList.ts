import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { passkeyCredentialViewCreate } from "../domain/passkeyCredentialViewCreate.js"
import { passkeyRepositoryCreate } from "../persistence/passkeyRepositoryCreate.js"
import type { PasskeyCredentialListResponse } from "../public/passkeyCredentialListResponseSchema.js"

type PasskeyCredentialListOptions = {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly userId: string
  readonly query?: ListQuery
}

export function passkeyCredentialList(options: PasskeyCredentialListOptions): Result<PasskeyCredentialListResponse> {
  const credentials = passkeyRepositoryCreate(options.database.db).passkeyCredentialList(
    options.realmId,
    options.userId,
  )
  if (!credentials.success) return credentials
  const views = credentials.data.map(passkeyCredentialViewCreate)
  return listRowsPage({
    idGet: (credential) => credential.id,
    query: options.query,
    rows: views,
    sortValueGet: (credential) => credential.createdAt,
  })
}
