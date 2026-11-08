import { englishCatalog } from "./englishCatalog.js"
import { i18nStore } from "./i18nStore.js"
import type { MessageKey } from "./messageKeySchema.js"
import { translationPlaceholdersApply } from "./translationPlaceholdersApply.js"

type PlaceholderValues = Readonly<Record<string, string | number>>

/** Translates a typed stable message key and falls back to its English catalog entry. Never throws: unknown keys render as the key. */
export function messageTranslate(key: MessageKey, values?: PlaceholderValues): string {
  const englishText = (englishCatalog as Record<string, string>)[key] ?? key
  const dictionary = i18nStore.dictionary.get() as Record<string, string>
  const translated =
    i18nStore.language.get() === "en" ? englishText : (dictionary[key] ?? dictionary[englishText] ?? englishText)
  return translationPlaceholdersApply(translated, values)
}
