export function zitadelMigrationDurationSecondsGet(value: unknown): number | undefined {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) return undefined
    return value
  }
  if (typeof value === "string") {
    const match = /^(\d+(?:\.\d+)?)s$/.exec(value.trim())
    if (match === null || match[1] === undefined) return undefined
    const seconds = Math.floor(Number(match[1]))
    if (!Number.isSafeInteger(seconds)) return undefined
    return seconds
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Readonly<Record<string, unknown>>
    if (!("seconds" in record)) return undefined
    const seconds = Number(record.seconds)
    const nanos = "nanos" in record ? Number(record.nanos) : 0
    if (!Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(nanos) || nanos < 0) return undefined
    return Math.floor(seconds) + Math.floor(nanos / 1_000_000_000)
  }
  return undefined
}
