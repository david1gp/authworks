import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { UserProfile } from "../public/userProfileSchema.js"

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
  return resultCreate(profile)
}
