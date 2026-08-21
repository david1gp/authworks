import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import { listRowsPage } from "../../../platform/http/listRowsPage.js"
import { listSortByResolve } from "../../../platform/http/listSortByResolve.js"
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
  readonly query?: ListQuery
}

export function oidcSigningKeyList(options: OidcSigningKeyListOptions): Result<OidcSigningKeyListResponse> {
  const authorized = oidcClientContextAuthorize({ context: options.context, realmId: options.realmId })
  if (!authorized.success) return authorized
  const rows = oidcRepositoryCreate(options.database.db).signingKeyList(options.realmId)
  if (!rows.success) return rows
  const sortBy = listSortByResolve(options.query?.sortBy, ["createdAt", "id"], "createdAt")
  if (!sortBy.success) return sortBy
  const signingKeys = []
  for (const row of rows.data) {
    const signingKey = oidcSigningKeyPublicViewCreate(row)
    if (!signingKey.success) return signingKey
    signingKeys.push(signingKey.data)
  }
  return listRowsPage({
    idGet: (signingKey) => signingKey.id,
    query: options.query,
    rows: signingKeys,
    sortDirection: options.query?.sortDirection ?? "desc",
    sortValueGet: (signingKey) => (sortBy.data === "id" ? signingKey.id : signingKey.createdAt),
  })
}
