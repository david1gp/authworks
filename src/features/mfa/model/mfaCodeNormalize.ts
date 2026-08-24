import type { MfaFactor } from "./mfaFactorSchema.js"

export function mfaCodeNormalize(factor: Extract<MfaFactor, "email-otp" | "recovery-code" | "totp">, value: string) {
  if (factor === "recovery-code") return value.toUpperCase().replace(/\s+/g, "").slice(0, 64)
  return value.replace(/\D/g, "").slice(0, 6)
}
