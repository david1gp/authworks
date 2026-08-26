import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { userProfilePictureCleanupRepositoryCreate } from "../persistence/userProfilePictureCleanupRepositoryCreate.js"

export function userProfilePictureCleanupUploadFailure(options: {
  readonly database: StorageDatabase
  readonly leaseToken: string
  readonly objectKey: string
}): Result<void> {
  const repository = userProfilePictureCleanupRepositoryCreate(options.database.db)
  const restored = repository.userProfilePictureCleanupUploadFailure({
    leaseToken: options.leaseToken,
    objectKey: options.objectKey,
  })
  if (!restored.success) return restored
  if (restored.data) return resultCreate(undefined)
  return repository.userProfilePictureCleanupEnqueue({
    createdAt: options.database.runtime.now(),
    objectKey: options.objectKey,
  })
}
