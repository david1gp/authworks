import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { R2ObjectStorage } from "../../../platform/storage/r2/r2ObjectStorage.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import { realmSystemContextCreate } from "../../realms/server/index.js"
import { userGet } from "./userGet.js"
import { userProfilePictureCleanupReserve } from "./userProfilePictureCleanupReserve.js"
import { userProfilePictureCleanupUploadFailure } from "./userProfilePictureCleanupUploadFailure.js"
import { userProfilePictureDownload } from "./userProfilePictureDownload.js"
import { userProfilePictureHost } from "./userProfilePictureHost.js"
import { userProfileUpdate } from "./userProfileUpdate.js"

type UserProfilePictureImportOptions = {
  readonly database: StorageDatabase
  readonly fetch?: typeof fetch
  readonly publicOrigin?: string
  readonly resolve?: (hostname: string) => Promise<readonly (string | { readonly address: string })[]>
  readonly sourceUrl: string
  readonly storage?: R2ObjectStorage
  readonly realmId: string
  readonly userId: string
}

export async function userProfilePictureImport(options: UserProfilePictureImportOptions): Promise<Result<void>> {
  const op = "userProfilePictureImport"
  const context = realmSystemContextCreate("system")
  const current = userGet({
    context,
    database: options.database,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!current.success) return current
  if (current.data.user.profile.picture !== undefined) return resultCreate(undefined)
  if (options.publicOrigin === undefined || options.storage === undefined)
    return resultErrorCreate(op, "Profile picture storage is unavailable.", "users.write-failed")

  const downloaded = await userProfilePictureDownload({
    fetch: options.fetch,
    resolve: options.resolve,
    sourceUrl: options.sourceUrl,
  })
  if (!downloaded.success) return downloaded
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
    body: downloaded.data.body,
    contentType: downloaded.data.contentType,
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
    return hosted
  }
  const updated = userProfileUpdate({
    context,
    database: options.database,
    input: {},
    picture: { contentType: hosted.data.contentType, url: hosted.data.url },
    pictureCandidateObjectKey: hosted.data.objectKey,
    pictureCandidateLeaseToken: reservationToken,
    pictureCleanupPublicOrigin: options.publicOrigin,
    pictureOnlyIfMissing: true,
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
  return resultCreate(undefined)
}
