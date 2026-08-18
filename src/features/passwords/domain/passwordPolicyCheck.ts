import { type Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate as resultErrorCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { PasswordPolicy } from "../public/passwordPolicySchema.js"

export function passwordPolicyCheck(password: string, policy: PasswordPolicy): Result<void> {
  const op = "passwordPolicyCheck"
  if (password.length < policy.minimumLength)
    return resultErrorCreate(op, "The password does not meet the password policy.", "passwords.invalid")
  if (policy.requireLowercase && !/[a-z]/.test(password))
    return resultErrorCreate(op, "The password does not meet the password policy.", "passwords.invalid")
  if (policy.requireUppercase && !/[A-Z]/.test(password))
    return resultErrorCreate(op, "The password does not meet the password policy.", "passwords.invalid")
  if (policy.requireNumber && !/[0-9]/.test(password))
    return resultErrorCreate(op, "The password does not meet the password policy.", "passwords.invalid")
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password))
    return resultErrorCreate(op, "The password does not meet the password policy.", "passwords.invalid")
  return resultCreate(undefined)
}
