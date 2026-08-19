import type { OrganizationLoginPolicy } from "../../organizations/public/organizationLoginPolicySchema.js"

export function loginPrimaryMethodsGet(policy: OrganizationLoginPolicy, providerCount: number) {
  const methods: Array<"password" | "email-otp" | "passkey" | "external-identity"> = []
  if (policy.allowPassword) methods.push("password")
  if (policy.allowEmailOtp) methods.push("email-otp")
  if (policy.allowPasskey) methods.push("passkey")
  if (policy.allowExternalIdentity && providerCount > 0) methods.push("external-identity")
  return methods
}
