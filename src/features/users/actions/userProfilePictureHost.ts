import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { runtimeCreate } from "../../../platform/runtime/runtimeCreate.js"
import type { R2ObjectStorage } from "../../../platform/storage/r2/r2ObjectStorage.js"
import { userPictureHashCreate } from "../domain/userPictureHashCreate.js"
import { userPictureGenerationCreate } from "../domain/userPictureGenerationCreate.js"
import { userPictureObjectKeyCreate } from "../domain/userPictureObjectKeyCreate.js"
import { userPicturePublicUrlCreate } from "../domain/userPicturePublicUrlCreate.js"
import { userPictureValidate } from "../domain/userPictureValidate.js"

const immutableCacheControl = "public, max-age=31536000, immutable"

export async function userProfilePictureHost(options: {
  readonly beforePut?: (input: { readonly objectKey: string; readonly url: string }) => Result<void>
  readonly body: Uint8Array
  readonly contentType: string
  readonly publicOrigin: string
  readonly runtime?: Pick<ReturnType<typeof runtimeCreate>, "randomBytes">
  readonly storage: R2ObjectStorage
  readonly userName: string
}): Promise<Result<{ contentType: string; objectKey: string; url: string }>> {
  const op = "userProfilePictureHost"
  const validated = userPictureValidate({ body: options.body, contentType: options.contentType })
  if (!validated.success) return validated
  const hash = userPictureHashCreate(options.body)
  if (!hash.success) return hash
  const generation = userPictureGenerationCreate(options.runtime)
  if (!generation.success) return generation
  const objectKey = userPictureObjectKeyCreate({
    extension: validated.data.extension,
    generation: generation.data,
    sha256: hash.data,
    userName: options.userName,
  })
  if (!objectKey.success) return objectKey
  const publicUrl = userPicturePublicUrlCreate({ objectKey: objectKey.data, publicOrigin: options.publicOrigin })
  if (!publicUrl.success) return publicUrl
  if (options.beforePut !== undefined) {
    const intent = options.beforePut({ objectKey: objectKey.data, url: publicUrl.data })
    if (!intent.success) return intent
  }

  let stored: Result<void>
  try {
    stored = await options.storage.put({
      body: options.body,
      cacheControl: immutableCacheControl,
      contentType: validated.data.contentType,
      key: objectKey.data,
    })
  } catch (_error) {
    return resultErrorCreate(op, "The user picture could not be hosted.")
  }
  if (!stored.success) return stored
  return resultCreate({ contentType: validated.data.contentType, objectKey: objectKey.data, url: publicUrl.data })
}
