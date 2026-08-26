import { type Result } from "#result"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { userProfilePictureCleanupRepositoryCreate } from "../persistence/userProfilePictureCleanupRepositoryCreate.js"

export function userProfilePictureCleanupEnqueue(options: {
  readonly database: StorageDatabase
  readonly objectKey: string
  readonly createdAt?: number
}): Result<void> {
  const op = "userProfilePictureCleanupEnqueue"
  const createdAt = options.createdAt ?? options.database.runtime.now()
  if (!Number.isSafeInteger(createdAt) || createdAt < 0)
    return resultErrorCreate(op, "The user picture cleanup timestamp is invalid.", "users.invalid-timestamp")
  return userProfilePictureCleanupRepositoryCreate(options.database.db).userProfilePictureCleanupEnqueue({
    createdAt,
    objectKey: options.objectKey,
  })
}
