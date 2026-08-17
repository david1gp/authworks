import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { InstanceSystemContext } from "../../instances/domain/instanceSystemContext.js"
import type { InstanceTenantContext } from "../../instances/domain/instanceTenantContext.js"
import { oidcClientContextAuthorize } from "../domain/oidcClientContextAuthorize.js"
import { oidcSigningKeyPublicViewCreate } from "../domain/oidcSigningKeyPublicViewCreate.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcSigningKeyListResponse } from "../public/oidcSigningKeyListResponseSchema.js"

type OidcSigningKeyListOptions = {
  readonly context: InstanceSystemContext | InstanceTenantContext
  readonly database: StorageDatabase
  readonly instanceId: string
}

export function oidcSigningKeyList(options: OidcSigningKeyListOptions): Result<OidcSigningKeyListResponse> {
  const authorized = oidcClientContextAuthorize({ context: options.context, instanceId: options.instanceId })
  if (!authorized.success) return authorized
  const rows = oidcRepositoryCreate(options.database.db).signingKeyList(options.instanceId)
  if (!rows.success) return rows
  const signingKeys = []
  for (const row of rows.data) {
    const signingKey = oidcSigningKeyPublicViewCreate(row)
    if (!signingKey.success) return signingKey
    signingKeys.push(signingKey.data)
  }
  return resultCreate({ signingKeys })
}
