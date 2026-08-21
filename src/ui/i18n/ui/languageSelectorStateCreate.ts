import * as v from "valibot"
import { i18nStore } from "../model/i18nStore.js"
import { languageSchema } from "../model/languageSchema.js"
import { languageSelect } from "../model/languageSelect.js"
import { languagesSupported } from "../model/languagesSupported.js"

/** Creates the shared locale selector state for demo and production layouts. */
export function languageSelectorStateCreate(browserWindow: () => Window = () => window) {
  return {
    language: i18nStore.language.get,
    options: languagesSupported,
    onChange: (event: Event) => {
      const parsed = v.safeParse(languageSchema, (event.currentTarget as HTMLSelectElement).value)
      if (!parsed.success) return
      void languageSelect(browserWindow(), parsed.output)
    },
  }
}
