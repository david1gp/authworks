import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { R2ObjectStorage } from "../../../platform/storage/r2/r2ObjectStorage.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext, RealmTenantContext } from "../../realms/server/index.js"
import { userPictureValidate } from "../domain/userPictureValidate.js"
import type { User } from "../public/userSchema.js"
import { userGet } from "./userGet.js"
import { userProfilePictureCleanupDrain } from "./userProfilePictureCleanupDrain.js"
import { userProfilePictureCleanupReserve } from "./userProfilePictureCleanupReserve.js"
import { userProfilePictureCleanupUploadFailure } from "./userProfilePictureCleanupUploadFailure.js"
import { userProfilePictureHost } from "./userProfilePictureHost.js"
import { userProfileUpdate } from "./userProfileUpdate.js"

type UserProfilePictureUploadOptions = {
  readonly body: Uint8Array
  readonly contentType: string
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly publicOrigin?: string
  readonly realmId: string
  readonly storage?: R2ObjectStorage
  readonly userId: string
}

export async function userProfilePictureUpload(
  options: UserProfilePictureUploadOptions,
): Promise<Result<{ user: User }>> {
  const op = "userProfilePictureUpload"
  const validated = userPictureValidate({ body: options.body, contentType: options.contentType })
  if (!validated.success) return resultErrorCreate(op, validated.errorMessage, "users.invalid")
  if (options.publicOrigin === undefined || options.storage === undefined)
    return resultErrorCreate(op, "Profile picture storage is unavailable.", "users.write-failed")

  const current = userGet({
    context: options.context,
    database: options.database,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!current.success) return current

  let reservedObjectKey: string | undefined
  let reservationToken: string | undefined
  const hosted = await userProfilePictureHost({
    beforePut: ({ objectKey }) => {
      const reserved = userProfilePictureCleanupReserve({ database: options.database, objectKey })
      if (!reserved.success) return reserved
      reservedObjectKey = objectKey
      reservationToken = reserved.data.leaseToken
      return resultCreate(undefined)
    },
    body: options.body,
    contentType: options.contentType,
    publicOrigin: options.publicOrigin,
    runtime: options.database.runtime,
    storage: options.storage,
    userName: current.data.user.userName,
  })
  if (!hosted.success) {
    if (reservedObjectKey !== undefined && reservationToken !== undefined)
      userProfilePictureCleanupUploadFailure({
        database: options.database,
        leaseToken: reservationToken,
        objectKey: reservedObjectKey,
      })
    return resultErrorCreate(op, hosted.errorMessage, "users.write-failed")
  }

  const updated = userProfileUpdate({
    context: options.context,
    database: options.database,
    input: {},
    picture: { contentType: hosted.data.contentType, url: hosted.data.url },
    pictureCandidateObjectKey: hosted.data.objectKey,
    pictureCandidateLeaseToken: reservationToken,
    pictureCleanupPublicOrigin: options.publicOrigin,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!updated.success) {
    if (reservationToken !== undefined)
      userProfilePictureCleanupUploadFailure({
        database: options.database,
        leaseToken: reservationToken,
        objectKey: hosted.data.objectKey,
      })
    return updated
  }
  await userProfilePictureCleanupDrain({
    database: options.database,
    publicOrigin: options.publicOrigin,
    storage: options.storage,
  })
  return updated
}
