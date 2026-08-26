import type { Result } from "#result"
import type { R2ObjectStorage } from "../../../platform/storage/r2/r2ObjectStorage.js"
import type { StorageDatabase } from "../../../platform/storage/storageDatabaseOpen.js"
import type { RealmSystemContext, RealmTenantContext } from "../../realms/server/index.js"
import type { User } from "../public/userSchema.js"
import { userGet } from "./userGet.js"
import { userProfilePictureCleanupDrain } from "./userProfilePictureCleanupDrain.js"
import { userProfileUpdate } from "./userProfileUpdate.js"

type UserProfilePictureRemoveOptions = {
  readonly context: RealmSystemContext | RealmTenantContext
  readonly database: StorageDatabase
  readonly publicOrigin?: string
  readonly realmId: string
  readonly storage?: R2ObjectStorage
  readonly userId: string
}

export async function userProfilePictureRemove(
  options: UserProfilePictureRemoveOptions,
): Promise<Result<{ user: User }>> {
  const current = userGet({
    context: options.context,
    database: options.database,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!current.success) return current

  const updated = userProfileUpdate({
    context: options.context,
    database: options.database,
    input: {},
    picture: null,
    pictureCleanupPublicOrigin: options.publicOrigin,
    realmId: options.realmId,
    userId: options.userId,
  })
  if (!updated.success) return updated
  await userProfilePictureCleanupDrain({
    database: options.database,
    publicOrigin: options.publicOrigin,
    storage: options.storage,
  })
  return updated
}
