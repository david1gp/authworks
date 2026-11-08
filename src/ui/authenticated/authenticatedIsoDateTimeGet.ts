/** Converts a timestamp to an ISO string for `datetime` attributes. Never throws: invalid or out-of-range values yield undefined. */
export function authenticatedIsoDateTimeGet(value: Date | number | string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined
  const timestamp = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value)
  if (!Number.isFinite(timestamp)) return undefined
  try {
    return new Date(timestamp).toISOString()
  } catch {
    return undefined
  }
}
