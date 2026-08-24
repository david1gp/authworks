/** Masks an email destination before it is shown on the one-time-code step. */
export function emailOtpEmailMask(email: string): string {
  const at = email.lastIndexOf("@")
  if (at <= 0 || at === email.length - 1) return "your email address"

  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const visible = local.slice(0, 2)
  const stars = "*".repeat(Math.min(5, Math.max(2, local.length - visible.length)))
  return `${visible}${stars}@${domain}`
}
