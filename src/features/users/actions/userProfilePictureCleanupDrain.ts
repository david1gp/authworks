import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import type { R2ObjectStorage } from "../../../platform/storage/r2/r2ObjectStorage.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { storageTransactionRun } from "../../../platform/storage/storageTransactionRun.js"
import { userProfilePictureCleanupLeaseDurationMs } from "./userProfilePictureCleanupLeaseDurationMs.js"
import { userProfilePictureCleanupRepositoryCreate } from "../persistence/userProfilePictureCleanupRepositoryCreate.js"

const cleanupDrainLimit = 25

export async function userProfilePictureCleanupDrain(options: {
  readonly database: StorageDatabase
  readonly limit?: number
  readonly onDeleteFailure?: (objectKey: string) => void
  readonly publicOrigin?: string
  readonly storage?: R2ObjectStorage
}): Promise<Result<void>> {
  if (options.storage === undefined || options.publicOrigin === undefined) return resultCreate(undefined)
  const limit = Math.min(options.limit ?? cleanupDrainLimit, cleanupDrainLimit)
  const repository = userProfilePictureCleanupRepositoryCreate(options.database.db)
  const now = options.database.runtime.now()
  const queued = repository.userProfilePictureCleanupList(limit, now)
  if (!queued.success) return queued

  for (const item of queued.data) {
    const leaseToken = uuidv7Create(options.database.runtime)
    const claimed = storageTransactionRun(options.database, (transaction) =>
      userProfilePictureCleanupRepositoryCreate(transaction).userProfilePictureCleanupClaimPendingDelete({
        leaseToken,
        leaseUntil: now + userProfilePictureCleanupLeaseDurationMs,
        now,
        objectKey: item.objectKey,
        publicOrigin: options.publicOrigin,
      }),
    )
    if (!claimed.success) return claimed
    if (!claimed.data) continue

    let deleted: Result<void>
    try {
      deleted = await options.storage.delete({ key: item.objectKey })
    } catch (_error) {
      const restored = storageTransactionRun(options.database, (transaction) =>
        userProfilePictureCleanupRepositoryCreate(transaction).userProfilePictureCleanupDeleteFailure({
          leaseToken,
          objectKey: item.objectKey,
        }),
      )
      if (!restored.success) return restored
      options.onDeleteFailure?.(item.objectKey)
      continue
    }
    if (!deleted.success) {
      const restored = storageTransactionRun(options.database, (transaction) =>
        userProfilePictureCleanupRepositoryCreate(transaction).userProfilePictureCleanupDeleteFailure({
          leaseToken,
          objectKey: item.objectKey,
        }),
      )
      if (!restored.success) return restored
      options.onDeleteFailure?.(item.objectKey)
      continue
    }
    const removed = storageTransactionRun(options.database, (transaction) =>
      userProfilePictureCleanupRepositoryCreate(transaction).userProfilePictureCleanupDeleteComplete({
        leaseToken,
        objectKey: item.objectKey,
      }),
    )
    if (!removed.success) return removed
  }
  return resultCreate(undefined)
}
