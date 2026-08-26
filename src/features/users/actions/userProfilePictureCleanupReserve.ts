import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { uuidv7Create } from "../../../platform/ids/uuidv7Create.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { userProfilePictureCleanupRepositoryCreate } from "../persistence/userProfilePictureCleanupRepositoryCreate.js"
import { userProfilePictureCleanupLeaseDurationMs } from "./userProfilePictureCleanupLeaseDurationMs.js"

export function userProfilePictureCleanupReserve(options: {
  readonly database: StorageDatabase
  readonly objectKey: string
}): Result<{ leaseToken: string }> {
  const now = options.database.runtime.now()
  if (!Number.isSafeInteger(now) || now < 0)
    return resultErrorCodedCreate(
      "userProfilePictureCleanupReserve",
      "The user picture cleanup timestamp is invalid.",
      "users.invalid-timestamp",
    )
  const leaseToken = uuidv7Create(options.database.runtime)
  const reserved = userProfilePictureCleanupRepositoryCreate(
    options.database.db,
  ).userProfilePictureCleanupReserveUploading({
    leaseToken,
    leaseUntil: now + userProfilePictureCleanupLeaseDurationMs,
    now,
    objectKey: options.objectKey,
  })
  if (!reserved.success) return reserved
  return resultCreate({ leaseToken })
}
