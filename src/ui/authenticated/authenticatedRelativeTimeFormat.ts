/** Formats a precise, abbreviated distance between two timestamps. */
export function authenticatedRelativeTimeFormat(
  date: Date | number,
  now: Date | number,
  locale: string,
  notation: "long" | "short" = "long",
): string {
  const dateMs = date instanceof Date ? date.getTime() : date
  const nowMs = now instanceof Date ? now.getTime() : now
  if (!Number.isFinite(dateMs) || !Number.isFinite(nowMs)) return ""
  const seconds = (dateMs - nowMs) / 1000
  if (Math.abs(seconds) < 60) {
    if (notation === "short") return "now"
    if (locale.toLowerCase().startsWith("en")) return "just now"
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" }).format(0, "second")
  }
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "always", style: "short" })
  const format = (amount: number, unit: Intl.RelativeTimeFormatUnit, abbreviation: string) => {
    if (notation === "short") {
      const shortUnit = unit === "minute" ? "m" : unit === "year" ? "y" : abbreviation
      return amount < 0 ? `${Math.abs(amount)}${shortUnit}` : `in ${amount}${shortUnit}`
    }
    if (!locale.toLowerCase().startsWith("en")) return formatter.format(amount, unit)
    return amount < 0 ? `${Math.abs(amount)} ${abbreviation} ago` : `in ${amount} ${abbreviation}`
  }
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) return format(minutes, "minute", "min")
  const hours = Math.round(seconds / 3600)
  if (Math.abs(hours) < 24) return format(hours, "hour", "h")
  const days = Math.round(seconds / 86400)
  if (Math.abs(days) < 30) return format(days, "day", "d")
  if (Math.abs(days) < 365) return format(Math.round(days / 30.44), "month", "mo")
  return format(Math.round(days / 365.25), "year", "yr")
}
