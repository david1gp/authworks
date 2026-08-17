import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { UserProfile } from "../public/userProfileSchema.js"

export function userProfileNormalize(input: UserProfile): Result<UserProfile> {
  const op = "userProfileNormalize"
  const profile = { ...input }
  const fields = ["displayName", "firstName", "gender", "lastName", "nickName", "preferredLanguage"] as const
  for (const key of fields) {
    const value = profile[key]
    if (value === undefined) continue
    const normalized = value.trim()
    if (normalized.length === 0) return resultErrorCreate(op, "User profile values must not be empty.")
    profile[key] = normalized
  }
  return resultCreate(profile)
}
