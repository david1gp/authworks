export const passwordEventTypes = {
  credentialChanged: "password.credential_changed",
  emailVerificationRequested: "password.email_verification_requested",
  emailVerified: "password.email_verified",
  loginFailed: "password.login_failed",
  loginSucceeded: "password.login_succeeded",
  locked: "password.locked",
  policyChanged: "password.policy_changed",
  recovered: "password.recovered",
  recoveryRequested: "password.recovery_requested",
  unlocked: "password.unlocked",
} as const
