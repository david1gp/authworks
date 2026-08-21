import type { OrganizationLoginPolicy } from "../../organizations/public/organizationLoginPolicySchema.js"

export type LoginPrimaryMethod = "email-otp" | "external-identity" | "passkey" | "password"

export function loginPrimaryMethodsGet(
  policy: OrganizationLoginPolicy,
  providerCount: number,
): readonly LoginPrimaryMethod[] {
  const methods: LoginPrimaryMethod[] = []
  if (policy.allowPassword) methods.push("password")
  if (policy.allowEmailOtp) methods.push("email-otp")
  if (policy.allowPasskey) methods.push("passkey")
  if (policy.allowExternalIdentity && providerCount > 0) methods.push("external-identity")
  return methods
}
