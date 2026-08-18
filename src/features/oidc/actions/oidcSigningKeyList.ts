import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { oidcClientContextAuthorize } from "../domain/oidcClientContextAuthorize.js"
import { oidcSigningKeyPublicViewCreate } from "../domain/oidcSigningKeyPublicViewCreate.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcSigningKeyListResponse } from "../public/oidcSigningKeyListResponseSchema.js"

type OidcSigningKeyListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
}

export function oidcSigningKeyList(options: OidcSigningKeyListOptions): Result<OidcSigningKeyListResponse> {
  const authorized = oidcClientContextAuthorize({ context: options.context, realmId: options.realmId })
  if (!authorized.success) return authorized
  const rows = oidcRepositoryCreate(options.database.db).signingKeyList(options.realmId)
  if (!rows.success) return rows
  const signingKeys = []
  for (const row of rows.data) {
    const signingKey = oidcSigningKeyPublicViewCreate(row)
    if (!signingKey.success) return signingKey
    signingKeys.push(signingKey.data)
  }
  return resultCreate({ signingKeys })
}
