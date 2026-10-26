import { passwordOrgPolicyTable } from "../persistence/passwordOrgPolicyTable.js"
import type { PasswordPolicy } from "../public/passwordPolicySchema.js"

export function passwordOrgPolicyRowCreate(
  realmId: string,
  organizationId: string,
  policy: PasswordPolicy,
  updatedAt: number,
  version: number,
): typeof passwordOrgPolicyTable.$inferInsert {
  return {
    lockoutDurationMs: policy.lockoutDurationMs,
    maxAgeDays: policy.maxAgeDays ?? null,
    maximumAttempts: policy.maximumAttempts,
    minimumLength: policy.minimumLength,
    organizationId,
    realmId,
    requireLowercase: policy.requireLowercase ? 1 : 0,
    requireNumber: policy.requireNumber ? 1 : 0,
    requireSymbol: policy.requireSymbol ? 1 : 0,
    requireUppercase: policy.requireUppercase ? 1 : 0,
    updatedAt,
    version,
  }
}
