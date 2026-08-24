/** Returns the whole seconds remaining before a new email code may be requested. */
export function emailOtpResendCountdownGet(retryAt: number, now = Date.now()): number {
  if (!Number.isFinite(retryAt) || retryAt <= now) return 0
  return Math.ceil((retryAt - now) / 1000)
}
