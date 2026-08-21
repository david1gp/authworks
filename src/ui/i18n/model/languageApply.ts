import { i18nStore } from "./i18nStore.js"
import { type Language } from "./languageSchema.js"
import { languagesSupported } from "./languagesSupported.js"
import { translationDictionaryLoad } from "./translationDictionaryLoad.js"

let languageApplyRequest = 0

/** Applies document direction and reactively loads the selected locale catalog. */
export async function languageApply(language: Language, browserWindow: Window = window): Promise<void> {
  const request = ++languageApplyRequest
  const option = languagesSupported.find((entry) => entry.code === language)
  browserWindow.document.documentElement.lang = language
  browserWindow.document.documentElement.dir = option?.dir ?? "ltr"
  i18nStore.dictionary.set({})
  i18nStore.language.set(language)
  if (language === "en") return

  const loaded = await translationDictionaryLoad(language, browserWindow.fetch.bind(browserWindow))
  if (request !== languageApplyRequest) return
  i18nStore.dictionary.set(loaded.success ? loaded.data : {})
}
