import * as v from "valibot"
import { userPictureAssetSchema } from "./userPictureAssetSchema.js"

export const userProfileSchema = v.strictObject({
  displayName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  firstName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  gender: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(64))),
  lastName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  nickName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  picture: v.optional(userPictureAssetSchema),
  preferredLanguage: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(16))),
})

export type UserProfile = v.InferOutput<typeof userProfileSchema>
