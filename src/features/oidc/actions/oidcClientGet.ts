import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { oidcClientContextAuthorize } from "../domain/oidcClientContextAuthorize.js"
import { oidcClientPublicViewCreate } from "../domain/oidcClientPublicViewCreate.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcClientResponse } from "../public/oidcClientResponseSchema.js"

type OidcClientGetOptions = {
  readonly clientId: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
}

export function oidcClientGet(options: OidcClientGetOptions): Result<OidcClientResponse> {
  const op = "oidcClientGet"
  const authorized = oidcClientContextAuthorize({ context: options.context, realmId: options.realmId })
  if (!authorized.success) return authorized
  const row = oidcRepositoryCreate(options.database.db).clientGet(options.realmId, options.clientId)
  if (!row.success) return row
  if (row.data === null || row.data.status === "removed")
    return resultErrorCodedCreate(op, "The OIDC client was not found.", "oidc.not-found")
  const client = oidcClientPublicViewCreate(row.data)
  if (!client.success) return client
  return resultCreate({ client: client.data })
}
