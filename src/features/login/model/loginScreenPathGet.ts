import type { LoginScreen } from "./loginScreenSchema.js"

const loginScreenPaths: Readonly<Record<LoginScreen, string>> = {
  chooser: "",
  "email-otp": "/email-otp",
  "email-otp-code": "/email-otp/code",
  loading: "/loading",
  logout: "/logout",
  "logout-done": "/logout/done",
  mfa: "/mfa",
  "mfa-email-otp": "/mfa/email-otp",
  "mfa-passkey": "/mfa/passkey",
  "mfa-recovery-code": "/mfa/recovery-code",
  "mfa-totp": "/mfa/totp",
  "mfa-totp-enroll": "/mfa/totp-enroll",
  passkey: "/passkey",
  password: "/password",
  "password-change-required": "/password/change-required",
  provider: "/idp",
  "recent-accounts": "/chooser/recent-accounts",
  "recovery-complete": "/password/reset/complete",
  "recovery-request": "/password/forgot",
  "recovery-reset": "/password/reset",
  "recovery-sent": "/password/forgot/sent",
  register: "/register",
  "register-done": "/register/done",
  "signed-in": "/signed-in",
  unsupported: "/unsupported",
  "verify-email": "/verify-email",
}

/** Builds the absolute href for a login screen under the active production or demo base path. */
export function loginScreenPathGet(screen: LoginScreen, basePath: string): string {
  return `${basePath}${loginScreenPaths[screen]}`
}
