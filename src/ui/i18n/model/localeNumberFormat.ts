import { i18nStore } from "./i18nStore.js"

/** Formats a number using the currently active UI locale. */
export function localeNumberFormat(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(i18nStore.language.get(), options).format(value)
}
