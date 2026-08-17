import * as v from "valibot"

export const sessionAuthenticationMethodSchema = v.picklist([
  "email_otp",
  "external_identity",
  "password",
  "recovery_code",
  "totp",
])

export type SessionAuthenticationMethod = v.InferOutput<typeof sessionAuthenticationMethodSchema>
