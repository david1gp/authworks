import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import type { PasswordPolicy } from "../public/passwordPolicySchema.js"

export function passwordPolicyCheck(password: string, policy: PasswordPolicy): Result<void> {
  const op = "passwordPolicyCheck"
  if (password.length < policy.minimumLength)
    return resultErrorCreate(op, "The password does not meet the password policy.")
  if (policy.requireLowercase && !/[a-z]/.test(password))
    return resultErrorCreate(op, "The password does not meet the password policy.")
  if (policy.requireUppercase && !/[A-Z]/.test(password))
    return resultErrorCreate(op, "The password does not meet the password policy.")
  if (policy.requireNumber && !/[0-9]/.test(password))
    return resultErrorCreate(op, "The password does not meet the password policy.")
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password))
    return resultErrorCreate(op, "The password does not meet the password policy.")
  return resultCreate(undefined)
}
