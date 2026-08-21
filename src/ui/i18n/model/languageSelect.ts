import { languageApply } from "./languageApply.js"
import { languagePreferenceSave } from "./languagePreferenceSave.js"
import type { Language } from "./languageSchema.js"

/** Persists and applies an explicit user locale selection. */
export async function languageSelect(browserWindow: Window, language: Language): Promise<void> {
  try {
    languagePreferenceSave(browserWindow.localStorage, language)
  } catch {}
  await languageApply(language, browserWindow)
}
