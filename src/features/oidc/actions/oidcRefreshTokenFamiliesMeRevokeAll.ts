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

export function oidcRefreshTokenFamiliesMeRevokeAll(options: {
  readonly database: StorageDatabase
  readonly realmId: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "now" | "randomBytes">
  readonly userId: string
}): Result<OidcRefreshTokenRevokeResponse> {
  const op = "oidcRefreshTokenFamiliesMeRevokeAll"
  if (options.realmId.length === 0 || options.userId.length === 0)
    return resultErrorCodedCreate(op, "The refresh-token family ownership is invalid.", "oidc.invalid")
  const runtime = options.runtime ?? options.database.runtime
  const now = runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCodedCreate(op, "The refresh-token revocation timestamp is invalid.", "oidc.invalid-timestamp")
  const correlationId = uuidv7Create(runtime)
  return storageTransactionRun(options.database, (transaction) => {
    const repository = oidcRepositoryCreate(transaction)
    let afterFamilyId: string | undefined
    let revoked = false
    while (true) {
      const page = repository.refreshTokenFamilyPage(options.realmId, options.userId, {
        ...(afterFamilyId === undefined
          ? {}
          : {
              after: {
                familyId: afterFamilyId,
                sortValue: afterFamilyId,
              },
            }),
        limit: 101,
        now,
        sortBy: "familyId",
      })
      if (!page.success) return page
      const families = page.data.slice(0, 100)
      for (const family of families) {
        const result = oidcRefreshTokenFamilyRevokeExecute({
          correlationId,
          family,
          now,
          runtime,
          transaction,
        })
        if (!result.success) return result
        revoked = revoked || result.data
      }
      if (page.data.length <= 100) break
      const last = families.at(-1)
      if (last === undefined) break
      afterFamilyId = last.familyId
    }
    return resultCreate({ revoked })
  })
}
