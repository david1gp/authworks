import type { Result } from "#result"
import type { EmailOtpStartResponse } from "../../emailOtp/public/emailOtpStartResponseSchema.js"
import type { MfaChallengeResponse } from "../../mfa/public/mfaChallengeResponseSchema.js"
import type { MfaTotpEnrollmentStartResponse } from "../../mfa/public/mfaTotpEnrollmentStartResponseSchema.js"
import type { OrganizationDiscoveryResponse } from "../../organizations/public/organizationDiscoveryResponseSchema.js"
import type { PasskeyAuthenticationStatus } from "../../passkeys/public/passkeyAuthenticationStatusSchema.js"
import type { LoginRecentAccount } from "../model/loginRecentAccountSchema.js"

export type LoginDiscovery = Extract<OrganizationDiscoveryResponse, { found: true }>

/** Result of any primary or second-factor authentication attempt in the hosted login. */
export type LoginAuthenticationOutcome = {
  readonly challenge?: MfaChallengeResponse
  readonly userId: string
}

/**
 * The complete set of side effects a hosted login page performs. The production adapter binds these
 * to cookie-mode browser clients; the demo adapter binds them to deterministic local fixtures.
 */
export type LoginAdapter = {
  readonly discover: () => Promise<Result<LoginDiscovery>>
  readonly emailOtpStart: (email: string) => Promise<Result<EmailOtpStartResponse>>
  readonly emailOtpVerify: (challengeId: string, code: string) => Promise<Result<LoginAuthenticationOutcome>>
  readonly interactionResume: () => void
  readonly logout: () => Promise<Result<{ readonly revoked: boolean }>>
  readonly mfaComplete: (token: string, code: string) => Promise<Result<LoginAuthenticationOutcome>>
  /** Optional MFA email transport. Production leaves this absent until the contract exists; demos may fixture it. */
  readonly mfaEmailOtpEnroll?: () => Promise<Result<EmailOtpStartResponse>>
  readonly mfaEmailOtpResend?: (challengeId: string) => Promise<Result<EmailOtpStartResponse>>
  readonly mfaEmailOtpStart?: () => Promise<Result<EmailOtpStartResponse>>
  readonly mfaEmailOtpVerify?: (challengeId: string, code: string) => Promise<Result<LoginAuthenticationOutcome>>
  /** Optional login-MFA passkey transport. The existing protected step-up API is not interchangeable with this. */
  readonly mfaPasskeyAuthenticate?: (options?: {
    readonly statusSet?: (status: PasskeyAuthenticationStatus) => void
  }) => Promise<Result<LoginAuthenticationOutcome>>
  readonly mfaTotpEnrollConfirm: (enrollmentId: string, code: string) => Promise<Result<{ readonly confirmed: true }>>
  readonly mfaTotpEnrollStart: () => Promise<Result<MfaTotpEnrollmentStartResponse>>
  readonly passkeyAuthenticate: (options?: {
    readonly statusSet?: (status: PasskeyAuthenticationStatus) => void
  }) => Promise<Result<LoginAuthenticationOutcome>>
  readonly passkeySupported: () => boolean
  readonly passwordChange: (currentPassword: string, newPassword: string) => Promise<Result<{ readonly changed: true }>>
  readonly passwordLogin: (identifier: string, password: string) => Promise<Result<LoginAuthenticationOutcome>>
  readonly providerStart: (providerId: string) => Promise<Result<{ readonly authorizationUrl: string }>>
  readonly recentAccounts: () => Promise<Result<readonly LoginRecentAccount[]>>
  readonly recentAccountResume: (sessionId: string) => Promise<Result<{ readonly resumed: true }>>
  readonly recoveryComplete: (token: string, newPassword: string) => Promise<Result<{ readonly changed: true }>>
  readonly recoveryRequest: (email: string) => Promise<Result<{ readonly accepted: true }>>
  readonly register: (input: {
    readonly displayName: string
    readonly email: string
    readonly password: string
    readonly userName: string
  }) => Promise<Result<{ readonly verificationRequired: true }>>
  readonly verifyEmail: (token: string) => Promise<Result<{ readonly email: string }>>
}
