import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { R2ObjectStorage } from "../../../platform/storage/r2/r2ObjectStorage.js"
import { userPictureObjectKeyFromPublicUrlCreate } from "../domain/userPictureObjectKeyFromPublicUrlCreate.js"

export async function userProfilePictureObjectDelete(options: {
  readonly publicOrigin?: string
  readonly storage?: R2ObjectStorage
  readonly url: string
  readonly userName: string
}): Promise<Result<void>> {
  const op = "userProfilePictureObjectDelete"
  if (options.publicOrigin === undefined) return resultCreate(undefined)
  const key = userPictureObjectKeyFromPublicUrlCreate({
    publicOrigin: options.publicOrigin,
    url: options.url,
    userName: options.userName,
  })
  if (!key.success) return key
  if (key.data === undefined) return resultCreate(undefined)
  if (options.storage === undefined) return resultErrorCreate(op, "Profile picture storage is unavailable.")

  try {
    const deleted = await options.storage.delete({ key: key.data })
    if (!deleted.success) return deleted
    return resultCreate(undefined)
  } catch (_error) {
    return resultErrorCreate(op, "The user picture could not be deleted.")
  }
}
