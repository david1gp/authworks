import * as v from "valibot"

/** Every hosted login destination that a production route or a `/demo/login` fixture can render. */
export const loginScreenSchema = v.picklist([
  "chooser",
  "recent-accounts",
  "password",
  "password-change-required",
  "register",
  "register-done",
  "verify-email",
  "email-otp",
  "email-otp-code",
  "passkey",
  "provider",
  "mfa",
  "mfa-totp",
  "mfa-totp-enroll",
  "mfa-email-otp",
  "mfa-passkey",
  "mfa-recovery-code",
  "recovery-request",
  "recovery-sent",
  "recovery-reset",
  "recovery-complete",
  "logout",
  "logout-done",
  "signed-in",
  "loading",
  "unsupported",
])

export type LoginScreen = v.InferOutput<typeof loginScreenSchema>
