import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { oidcClientContextAuthorize } from "../domain/oidcClientContextAuthorize.js"
import { oidcClientPublicViewCreate } from "../domain/oidcClientPublicViewCreate.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcClientListResponse } from "../public/oidcClientListResponseSchema.js"

type OidcClientListOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
}

export function oidcClientList(options: OidcClientListOptions): Result<OidcClientListResponse> {
  const authorized = oidcClientContextAuthorize({ context: options.context, realmId: options.realmId })
  if (!authorized.success) return authorized
  const rows = oidcRepositoryCreate(options.database.db).clientList(options.realmId)
  if (!rows.success) return rows
  const clients = []
  for (const row of rows.data) {
    if (row.status === "removed") continue
    const client = oidcClientPublicViewCreate(row)
    if (!client.success) return client
    clients.push(client.data)
  }
  return resultCreate({ clients })
}
