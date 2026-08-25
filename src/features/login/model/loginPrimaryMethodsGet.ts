import type { OrganizationLoginPolicy } from "../../organizations/public/organizationLoginPolicySchema.js"

export type LoginPrimaryMethod = "email-otp" | "external-identity" | "passkey" | "password" | "whatsapp-otp"

export function loginPrimaryMethodsGet(
  policy: OrganizationLoginPolicy,
  providerCount: number,
  whatsappOtpAvailable = false,
): readonly LoginPrimaryMethod[] {
  const methods: LoginPrimaryMethod[] = []
  if (policy.allowEmailOtp) methods.push("email-otp")
  if (policy.allowWhatsappOtp === true && whatsappOtpAvailable) methods.push("whatsapp-otp")
  if (policy.allowPassword) methods.push("password")
  if (policy.allowPasskey) methods.push("passkey")
  if (policy.allowExternalIdentity && providerCount > 0) methods.push("external-identity")
  return methods
}
