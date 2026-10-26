import type { PasswordOrgPolicyRow } from "../persistence/passwordOrgPolicyTable.js"
import type { PasswordPolicy } from "../public/passwordPolicySchema.js"

export function passwordOrgPolicyViewCreate(row: PasswordOrgPolicyRow): PasswordPolicy {
  return {
    lockoutDurationMs: row.lockoutDurationMs,
    maxAgeDays: row.maxAgeDays ?? null,
    maximumAttempts: row.maximumAttempts,
    minimumLength: row.minimumLength,
    requireLowercase: row.requireLowercase === 1,
    requireNumber: row.requireNumber === 1,
    requireSymbol: row.requireSymbol === 1,
    requireUppercase: row.requireUppercase === 1,
  }
}
