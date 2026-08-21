import * as v from "valibot"

import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { languagePreferenceKey } from "./languagePreferenceKey.js"
import { type Language, languageSchema } from "./languageSchema.js"

/** Reads and validates the explicit locale override from browser storage. */
export function languagePreferenceLoad(storage: Storage): Result<Language | undefined> {
  const op = "languagePreferenceLoad"
  let stored: string | null
  try {
    stored = storage.getItem(languagePreferenceKey)
  } catch {
    return resultErrorCreate(op, "Language preference is unavailable.")
  }
  if (stored === null) return resultCreate(undefined)

  const parsed = v.safeParse(languageSchema, stored)
  if (!parsed.success) {
    try {
      storage.removeItem(languagePreferenceKey)
    } catch {}
    return resultErrorCreate(op, "Stored language preference is invalid.")
  }
  return resultCreate(parsed.output)
}
