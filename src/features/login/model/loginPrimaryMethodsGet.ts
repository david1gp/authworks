export type LoginPrimaryMethod = "email-otp" | "external-identity" | "passkey" | "password" | "whatsapp-otp"

type LoginPrimaryMethodsPolicy = {
  readonly allowEmailOtp: boolean
  readonly allowExternalIdentity: boolean
  readonly allowPasskey: boolean
  readonly allowPassword: boolean
  readonly allowWhatsappOtp?: boolean
}

export function loginPrimaryMethodsGet(
  policy: LoginPrimaryMethodsPolicy,
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
