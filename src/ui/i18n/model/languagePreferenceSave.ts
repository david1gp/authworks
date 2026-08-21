import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { languagePreferenceKey } from "./languagePreferenceKey.js"
import type { Language } from "./languageSchema.js"

/** Persists an explicit locale selection when browser storage is available. */
export function languagePreferenceSave(storage: Storage, language: Language): Result<undefined> {
  const op = "languagePreferenceSave"
  try {
    storage.setItem(languagePreferenceKey, language)
  } catch {
    return resultErrorCreate(op, "Language preference could not be saved.")
  }
  return resultCreate(undefined)
}
