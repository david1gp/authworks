import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { oidcSigningKeyPublicViewCreate } from "../domain/oidcSigningKeyPublicViewCreate.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcJwks } from "../public/oidcJwksSchema.js"

type OidcJwksGetOptions = {
  readonly database: StorageDatabase
  readonly instanceId: string
}

export function oidcJwksGet(options: OidcJwksGetOptions): Result<OidcJwks> {
  const rows = oidcRepositoryCreate(options.database.db).signingKeyList(options.instanceId)
  if (!rows.success) return rows
  const keys = []
  for (const row of rows.data) {
    const signingKey = oidcSigningKeyPublicViewCreate(row)
    if (!signingKey.success) return signingKey
    keys.push(signingKey.data.publicJwk)
  }
  return resultCreate({ keys })
}
