const passwordMaxAgeDayMs = 24 * 60 * 60 * 1_000

export function passwordMaxAgeExpired(changedAt: number, maxAgeDays: number | null | undefined, now: number): boolean {
  if (maxAgeDays === null || maxAgeDays === undefined) return false
  if (!Number.isSafeInteger(changedAt) || !Number.isSafeInteger(now)) return false
  return changedAt + maxAgeDays * passwordMaxAgeDayMs < now
}
