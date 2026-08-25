import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { oidcRepositoryCreate } from "../persistence/oidcRepositoryCreate.js"
import type { OidcRefreshTokenRevokeResponse } from "../public/oidcRefreshTokenRevokeResponseSchema.js"
import { oidcRefreshTokenFamilyRevokeExecute } from "./oidcRefreshTokenFamilyRevokeExecute.js"

export function oidcRefreshTokenFamilyMeRevoke(options: {
  readonly database: StorageDatabase
  readonly familyId: string
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
}): Result<OidcRefreshTokenRevokeResponse> {
  const op = "oidcRefreshTokenFamilyMeRevoke"
  if (options.realmId.length === 0 || options.userId.length === 0 || options.familyId.length === 0)
    return resultErrorCodedCreate(op, "The refresh-token family ownership is invalid.", "oidc.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCodedCreate(op, "The refresh-token revocation timestamp is invalid.", "oidc.invalid-timestamp")
  const correlationId = uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const family = oidcRepositoryCreate(transaction).refreshTokenFamilyGet(
      options.realmId,
      options.userId,
      options.familyId,
    )
    if (!family.success) return family
    if (family.data === null) return resultCreate({ revoked: false })
    const revoked = oidcRefreshTokenFamilyRevokeExecute({
      correlationId,
      family: family.data,
      now,
      runtime,
      transaction,
    })
    if (!revoked.success) return revoked
    return resultCreate({ revoked: revoked.data })
  })
}
