import { type Result } from "#result"
import * as v from "valibot"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { UserProfile } from "../public/userProfileSchema.js"
import { userPictureAssetSchema } from "../public/userPictureAssetSchema.js"

type UserProfileNormalizeInput = {
  readonly [K in keyof UserProfile]?: UserProfile[K] | null
}

export function userProfileNormalize(input: UserProfileNormalizeInput): Result<UserProfileNormalizeInput> {
  const op = "userProfileNormalize"
  const profile = { ...input }
  const fields = ["displayName", "firstName", "gender", "lastName", "nickName", "preferredLanguage"] as const
  for (const key of fields) {
    const value = profile[key]
    if (value === undefined || value === null) continue
    const normalized = value.trim()
    if (normalized.length === 0)
      return resultErrorCreate(op, "User profile values must not be empty.", "users.invalid-profile")
    profile[key] = normalized
  }
  const picture = profile.picture
  if (picture !== undefined && picture !== null) {
    const normalizedPicture = {
      ...picture,
      ...(picture.contentType === undefined ? {} : { contentType: picture.contentType.trim() }),
      url: picture.url.trim(),
    }
    const parsed = v.safeParse(userPictureAssetSchema, normalizedPicture)
    if (!parsed.success) return resultErrorCreate(op, "The user picture asset is invalid.", "users.invalid-profile")
    profile.picture = parsed.output
  }
  return resultCreate(profile)
}
