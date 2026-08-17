import type { MfaPolicy } from "../public/mfaPolicySchema.js"

export const mfaPolicyDefaults: MfaPolicy = {
  lockoutDurationMs: 15 * 60 * 1_000,
  maxAttempts: 5,
  mode: "disabled",
  totpWindow: 1,
}
