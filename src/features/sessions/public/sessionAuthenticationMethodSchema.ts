import * as v from "valibot"

export const sessionAuthenticationMethodSchema = v.picklist([
  "bootstrap_admin",
  "email_otp",
  "external_identity",
  "impersonation",
  "password",
  "passkey",
  "recovery_code",
  "totp",
])

export type SessionAuthenticationMethod = v.InferOutput<typeof sessionAuthenticationMethodSchema>
