/** Keeps one-time-code input numeric and bounded to Authworks' six-digit contract. */
export function emailOtpCodeNormalize(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6)
}
