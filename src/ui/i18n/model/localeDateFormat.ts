import { i18nStore } from "./i18nStore.js"

/** Formats a date or timestamp using the currently active UI locale. Never throws: invalid or out-of-range values render as empty. */
export function localeDateFormat(value: Date | number, options?: Intl.DateTimeFormatOptions): string {
  const timestamp = value instanceof Date ? value.getTime() : value
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return ""
  try {
    return new Intl.DateTimeFormat(i18nStore.language.get(), options).format(timestamp)
  } catch {
    return ""
  }
}
