import { languageFromTagGet } from "./languageFromTagGet.js"
import type { Language } from "./languageSchema.js"

/** Returns the first supported browser locale, with English as the fallback. */
export function languageBrowserPreferenceGet(tags: readonly string[]): Language {
  for (const tag of tags) {
    const language = languageFromTagGet(tag)
    if (language) return language
  }
  return "en"
}
