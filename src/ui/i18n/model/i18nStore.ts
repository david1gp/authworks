import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { Language } from "./languageSchema.js"

/** Reactive locale and runtime catalog state shared by all UI views. */
export const i18nStore = {
  language: createSignalObject<Language>("en"),
  dictionary: createSignalObject<Record<string, string>>({}),
}
