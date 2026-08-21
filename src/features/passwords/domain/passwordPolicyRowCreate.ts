import { passwordPolicyTable } from "../persistence/passwordPolicyTable.js"
import type { PasswordPolicy } from "../public/passwordPolicySchema.js"

export function passwordPolicyRowCreate(
  realmId: string,
  policy: PasswordPolicy,
  updatedAt: number,
  version: number,
): typeof passwordPolicyTable.$inferInsert {
  return {
    realmId,
    lockoutDurationMs: policy.lockoutDurationMs,
    maximumAttempts: policy.maximumAttempts,
    minimumLength: policy.minimumLength,
    requireLowercase: policy.requireLowercase ? 1 : 0,
    requireNumber: policy.requireNumber ? 1 : 0,
    requireSymbol: policy.requireSymbol ? 1 : 0,
    requireUppercase: policy.requireUppercase ? 1 : 0,
    updatedAt,
    version,
  }
}
