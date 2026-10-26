import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import type { RealmSystemContext } from "../../realms/domain/realmSystemContext.js"
import type { RealmTenantContext } from "../../realms/domain/realmTenantContext.js"
import { oidcClientContextAuthorize } from "../domain/oidcClientContextAuthorize.js"
import { oidcSigningKeyPublicViewCreate } from "../domain/oidcSigningKeyPublicViewCreate.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcSigningKeyResponse } from "../public/oidcSigningKeyResponseSchema.js"

type OidcSigningKeyDeleteOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly signingKeyId: string
}

export function oidcSigningKeyDelete(options: OidcSigningKeyDeleteOptions): Result<OidcSigningKeyResponse> {
  const op = "oidcSigningKeyDelete"
  const authorized = oidcClientContextAuthorize({ context: options.context, realmId: options.realmId })
  if (!authorized.success) return authorized
  const runtime = options.runtime ?? options.database.runtime
  const deletedAt = runtime.now()
  if (!Number.isSafeInteger(deletedAt) || deletedAt < 0)
    return resultErrorCodedCreate(op, "The signing key timestamp is invalid.", "oidc.invalid-timestamp")
  return storageTransactionRun(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    const current = repository.signingKeyGet(options.realmId, options.signingKeyId)
    if (!current.success) return current
    if (current.data === null) return resultErrorCodedCreate(op, "The signing key was not found.", "oidc.not-found")
    // Only retired keys are deletable: deleting the active key would leave
    // the realm unable to mint tokens.
    if (current.data.status !== "retired")
      return resultErrorCodedCreate(op, "Only retired signing keys can be deleted.", "oidc.conflict")
    const deleted = repository.signingKeyDelete(options.realmId, options.signingKeyId)
    if (!deleted.success) return deleted
    if (deleted.data === null) return resultErrorCodedCreate(op, "The signing key was not found.", "oidc.not-found")
    const signingKey = oidcSigningKeyPublicViewCreate(deleted.data)
    if (!signingKey.success) return signingKey
    return resultCreate({ signingKey: signingKey.data })
  })
}
