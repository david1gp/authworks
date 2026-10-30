import { i18nStore } from "./i18nStore.js"
import { type Language } from "./languageSchema.js"
import { languagesSupported } from "./languagesSupported.js"
import { translationDictionaryLoad } from "./translationDictionaryLoad.js"

let languageApplyRequest = 0

/**
 * Applies document direction and reactively loads the selected locale catalog. When the catalog
 * cannot be loaded the previous locale is restored, so the selector never claims a language
 * the interface is not actually showing.
 */
export async function languageApply(language: Language, browserWindow: Window = window): Promise<void> {
  const request = ++languageApplyRequest
  const previousLanguage = i18nStore.language.get()
  const previousDictionary = i18nStore.dictionary.get()
  const documentElement = browserWindow.document.documentElement
  const previousLang = documentElement.lang
  const previousDir = documentElement.dir
  const option = languagesSupported.find((entry) => entry.code === language)
  documentElement.lang = language
  documentElement.dir = option?.dir ?? "ltr"
  i18nStore.dictionary.set({})
  i18nStore.language.set(language)
  if (language === "en") return

  const loaded = await translationDictionaryLoad(language, browserWindow.fetch.bind(browserWindow))
  if (request !== languageApplyRequest) return
  if (!loaded.success) {
    documentElement.lang = previousLang
    documentElement.dir = previousDir
    i18nStore.dictionary.set(previousDictionary)
    i18nStore.language.set(previousLanguage)
    return
  }
  i18nStore.dictionary.set(loaded.data)
}
