import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { Language } from "./languageSchema.js"
import { translationCsvParse } from "./translationCsvParse.js"

type TranslationFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

/** Fetches and parses `/i18n/{locale}.csv`; English uses the built-in catalog fallback. */
export async function translationDictionaryLoad(
  language: Language,
  fetcher: TranslationFetch = globalThis.fetch,
): Promise<Result<Record<string, string>>> {
  const op = "translationDictionaryLoad"
  if (language === "en") return resultCreate({})

  let response: Response
  try {
    response = await fetcher(`/i18n/${language}.csv`, { headers: { accept: "text/csv" } })
  } catch {
    return resultErrorCreate(op, "Translations could not be loaded.")
  }
  if (!response.ok) return resultErrorCreate(op, "Translations could not be loaded.")

  let csv: string
  try {
    csv = await response.text()
  } catch {
    return resultErrorCreate(op, "Translations could not be read.")
  }
  return translationCsvParse(csv)
}
