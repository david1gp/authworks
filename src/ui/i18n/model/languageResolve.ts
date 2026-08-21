import { languageBrowserPreferenceGet } from "./languageBrowserPreferenceGet.js"
import { languagePreferenceLoad } from "./languagePreferenceLoad.js"
import type { Language } from "./languageSchema.js"

/** Resolves an explicit stored locale before considering browser preferences. */
export function languageResolve(storage: Storage | undefined, tags: readonly string[]): Language {
  if (storage) {
    const stored = languagePreferenceLoad(storage)
    if (stored.success && stored.data) return stored.data
  }
  return languageBrowserPreferenceGet(tags)
}
