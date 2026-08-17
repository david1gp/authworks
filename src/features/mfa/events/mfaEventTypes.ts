export const mfaEventTypes = {
  challengeCompleted: "mfa.challenge.completed",
  challengeFailed: "mfa.challenge.failed",
  challengeStarted: "mfa.challenge.started",
  policyChanged: "mfa.policy.changed",
  recoveryCodesGenerated: "mfa.recovery_codes.generated",
  recoveryCodeUsed: "mfa.recovery_code.used",
  totpEnrollmentConfirmed: "mfa.totp.enrollment.confirmed",
  totpEnrollmentStarted: "mfa.totp.enrollment.started",
  totpRemoved: "mfa.totp.removed",
  totpVerified: "mfa.totp.verified",
} as const
