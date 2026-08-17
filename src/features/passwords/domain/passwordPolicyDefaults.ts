import type { PasswordPolicy } from "../public/passwordPolicySchema.js"

export const passwordPolicyDefaults: PasswordPolicy = {
  minimumLength: 12,
  requireLowercase: false,
  requireUppercase: false,
  requireNumber: false,
  requireSymbol: false,
  maximumAttempts: 5,
  lockoutDurationMs: 15 * 60 * 1_000,
}
