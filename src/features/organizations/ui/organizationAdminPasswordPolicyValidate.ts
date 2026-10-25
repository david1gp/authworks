import * as v from "valibot"
import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import { passwordPolicySchema } from "../../passwords/public/passwordPolicySchema.js"
import type { PasswordPolicy } from "../../passwords/public/passwordPolicySchema.js"

/** Validates the realm password-policy draft against the shared entity schema. */
export function organizationAdminPasswordPolicyValidate(draft: PasswordPolicy): MessageKey | undefined {
  const result = v.safeParse(passwordPolicySchema, draft)
  if (result.success) return undefined
  const key = result.issues[0]?.path?.[0]?.key
  if (key === "minimumLength") return "admin.organizations.passwordPolicy.validation.minimumLength"
  if (key === "maximumAttempts") return "admin.organizations.passwordPolicy.validation.maximumAttempts"
  if (key === "lockoutDurationMs") return "admin.organizations.passwordPolicy.validation.lockout"
  return "admin.organizations.passwordPolicy.validation.policy"
}
