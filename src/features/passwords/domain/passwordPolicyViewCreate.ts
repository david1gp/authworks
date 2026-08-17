import type { PasswordPolicy } from "../public/passwordPolicySchema.js"
import type { PasswordPolicyRow } from "../persistence/passwordPolicyTable.js"

export function passwordPolicyViewCreate(row: PasswordPolicyRow): PasswordPolicy {
  return {
    lockoutDurationMs: row.lockoutDurationMs,
    maximumAttempts: row.maximumAttempts,
    minimumLength: row.minimumLength,
    requireLowercase: row.requireLowercase === 1,
    requireNumber: row.requireNumber === 1,
    requireSymbol: row.requireSymbol === 1,
    requireUppercase: row.requireUppercase === 1,
  }
}
