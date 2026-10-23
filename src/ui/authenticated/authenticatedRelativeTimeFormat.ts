/** Formats the distance between two timestamps as a relative phrase ("3 hours ago"). */
export function authenticatedRelativeTimeFormat(date: Date | number, now: Date | number, locale: string): string {
  const dateMs = date instanceof Date ? date.getTime() : date
  const nowMs = now instanceof Date ? now.getTime() : now
  if (Number.isNaN(dateMs) || Number.isNaN(nowMs)) return ""
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const seconds = Math.round((dateMs - nowMs) / 1000)
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second")
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute")
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour")
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 7) return formatter.format(days, "day")
  if (Math.abs(days) < 30) return formatter.format(Math.round(days / 7), "week")
  if (Math.abs(days) < 365) return formatter.format(Math.round(days / 30.44), "month")
  return formatter.format(Math.round(days / 365.25), "year")
}
