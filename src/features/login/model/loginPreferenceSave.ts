import { createResult, type Result } from "#result"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { loginPreferenceKey } from "./loginPreferenceKey.js"
import type { LoginPreference } from "./loginPreferenceSchema.js"

/** Saves a validated organization-scoped hosted-login preference. */
export function loginPreferenceSave(
  storage: Storage,
  organizationId: string,
  preference: LoginPreference,
): Result<undefined> {
  const op = "loginPreferenceSave"
  try {
    storage.setItem(loginPreferenceKey(organizationId), JSON.stringify(preference))
  } catch {
    return resultErrorCreate(op, "Login preferences could not be saved.")
  }
  return createResult(undefined)
}
