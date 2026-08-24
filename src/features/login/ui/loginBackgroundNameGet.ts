import type { LoginScreen } from "../model/loginScreenSchema.js"

export function loginBackgroundNameGet(screen: LoginScreen) {
  switch (screen) {
    case "loading":
      return "loading"
    case "unsupported":
      return "fatal"
    case "email-otp":
    case "email-otp-code":
    case "verify-email":
      return "email-otp"
    case "password":
      return "password"
    case "password-change-required":
      return "password-change"
    case "passkey":
      return "passkey"
    case "provider":
      return "provider"
    case "mfa":
    case "mfa-email-otp":
    case "mfa-email-otp-enroll":
    case "mfa-email-otp-code":
    case "mfa-enroll":
    case "mfa-loading":
    case "mfa-optional":
    case "mfa-options-unavailable":
    case "mfa-passkey":
    case "mfa-passkey-enroll":
    case "mfa-recovery-code":
    case "mfa-satisfied":
    case "mfa-totp":
    case "mfa-totp-enroll":
      return "mfa"
    case "recovery-complete":
    case "recovery-request":
    case "recovery-reset":
    case "recovery-sent":
      return "recovery"
    case "recent-accounts":
      return "directory"
    default:
      return "chooser"
  }
}
