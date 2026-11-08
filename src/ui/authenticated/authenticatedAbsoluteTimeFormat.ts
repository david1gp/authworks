/** Formats a timestamp as an absolute local date/time for `title` tooltips and meta rows. Never throws. */
export function authenticatedAbsoluteTimeFormat(value: Date | number, locale: string): string {
  const dateMs = value instanceof Date ? value.getTime() : value
  if (typeof dateMs !== "number" || !Number.isFinite(dateMs)) return ""
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(dateMs)
  } catch {
    return ""
  }
}
