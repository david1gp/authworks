import { englishCatalog } from "./englishCatalog.js"
import { i18nStore } from "./i18nStore.js"
import type { MessageKey } from "./messageKeySchema.js"
import { translationPlaceholdersApply } from "./translationPlaceholdersApply.js"

type PlaceholderValues = Readonly<Record<string, string | number>> | readonly (string | number)[]

const englishTextToKeyMap = new Map<string, MessageKey>()
for (const [key, text] of Object.entries(englishCatalog) as [MessageKey, string][]) {
  if (!englishTextToKeyMap.has(text)) {
    englishTextToKeyMap.set(text, key)
  }
}

/** Translates an English source string, preserving compatibility with ZITADEL catalog keys. */
export function ttc(englishText: string, values?: PlaceholderValues): string {
  if (i18nStore.language.get() === "en") return translationPlaceholdersApply(englishText, values)
  const dictionary = i18nStore.dictionary.get()
  const direct = dictionary[englishText]
  if (direct !== undefined) return translationPlaceholdersApply(direct, values)

  const messageKey = englishTextToKeyMap.get(englishText)
  if (messageKey !== undefined) {
    const translated = dictionary[messageKey]
    if (translated !== undefined) return translationPlaceholdersApply(translated, values)
  }

  return translationPlaceholdersApply(englishText, values)
}
