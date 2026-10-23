/** Formats a timestamp as an absolute local date/time for `title` tooltips and meta rows. */
export function authenticatedAbsoluteTimeFormat(value: Date | number, locale: string): string {
  const dateMs = value instanceof Date ? value.getTime() : value
  if (Number.isNaN(dateMs)) return ""
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(dateMs)
}
