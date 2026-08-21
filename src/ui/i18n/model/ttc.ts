import { i18nStore } from "./i18nStore.js"
import { translationPlaceholdersApply } from "./translationPlaceholdersApply.js"

type PlaceholderValues = Readonly<Record<string, string | number>> | readonly (string | number)[]

/** Translates an English source string, preserving compatibility with ZITADEL catalog keys. */
export function ttc(englishText: string, values?: PlaceholderValues): string {
  const dictionary = i18nStore.dictionary.get()
  const translated = i18nStore.language.get() === "en" ? englishText : (dictionary[englishText] ?? englishText)
  return translationPlaceholdersApply(translated, values)
}
