import { i18nStore } from "./i18nStore.js"

/** Formats a date or timestamp using the currently active UI locale. */
export function localeDateFormat(value: Date | number, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(i18nStore.language.get(), options).format(value)
}
