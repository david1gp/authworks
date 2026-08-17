import type { PasswordPolicy } from "../public/passwordPolicySchema.js"
import { passwordPolicyTable } from "../persistence/passwordPolicyTable.js"

export function passwordPolicyRowCreate(
  instanceId: string,
  policy: PasswordPolicy,
  updatedAt: number,
  version: number,
): typeof passwordPolicyTable.$inferInsert {
  return {
    instanceId,
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
