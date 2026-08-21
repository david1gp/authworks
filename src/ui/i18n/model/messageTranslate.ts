import { englishCatalog } from "./englishCatalog.js"
import { i18nStore } from "./i18nStore.js"
import type { MessageKey } from "./messageKeySchema.js"
import { translationPlaceholdersApply } from "./translationPlaceholdersApply.js"

type PlaceholderValues = Readonly<Record<string, string | number>>

/** Translates a typed stable message key and falls back to its English catalog entry. */
export function messageTranslate(key: MessageKey, values?: PlaceholderValues): string {
  const englishText = englishCatalog[key]
  const dictionary = i18nStore.dictionary.get()
  const translated =
    i18nStore.language.get() === "en" ? englishText : (dictionary[key] ?? dictionary[englishText] ?? englishText)
  return translationPlaceholdersApply(translated, values)
}
