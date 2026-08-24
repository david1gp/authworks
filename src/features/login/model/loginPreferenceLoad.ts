import * as v from "valibot"
import { createResult, type Result } from "#result"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { loginPreferenceKey } from "./loginPreferenceKey.js"
import { type LoginPreference, loginPreferenceSchema } from "./loginPreferenceSchema.js"

const identifierMaxAge = 180 * 24 * 60 * 60 * 1000

/** Loads and validates the optional, organization-scoped remembered identifier. */
export function loginPreferenceLoad(storage: Storage, organizationId: string): Result<LoginPreference | undefined> {
  const op = "loginPreferenceLoad"
  const key = loginPreferenceKey(organizationId)
  let stored: string | null
  try {
    stored = storage.getItem(key)
  } catch {
    return resultErrorCreate(op, "Login preferences are unavailable.")
  }
  if (stored === null) return createResult(undefined)

  let input: unknown
  try {
    input = JSON.parse(stored)
  } catch {
    preferenceRemove(storage, key)
    return resultErrorCreate(op, "Stored login preferences are invalid.")
  }
  const parsed = v.safeParse(loginPreferenceSchema, input)
  if (!parsed.success) {
    preferenceRemove(storage, key)
    return resultErrorCreate(op, "Stored login preferences are invalid.")
  }
  if (
    (parsed.output.identifier !== undefined || parsed.output.email !== undefined) &&
    Date.now() - parsed.output.updatedAt > identifierMaxAge
  ) {
    const cleaned: LoginPreference = {
      ...parsed.output,
      email: undefined,
      identifier: undefined,
      updatedAt: Date.now(),
    }
    const saved = loginPreferenceSaveWithoutResult(storage, key, cleaned)
    if (!saved) return createResult({ ...cleaned, identifier: undefined })
    return createResult(cleaned)
  }
  return createResult(parsed.output)
}

function preferenceRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key)
  } catch {
    // Browser storage is an optional enhancement to the sign-in flow.
  }
}

function loginPreferenceSaveWithoutResult(storage: Storage, key: string, preference: LoginPreference): boolean {
  try {
    storage.setItem(key, JSON.stringify(preference))
    return true
  } catch {
    return false
  }
}
