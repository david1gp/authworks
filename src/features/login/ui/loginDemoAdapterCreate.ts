import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { demoLoginBootstrap } from "../../demo/demoLoginBootstrap.js"
import { demoLoginRecentAccounts } from "../../demo/demoLoginRecentAccounts.js"
import type { LoginAdapter } from "./loginAdapter.js"

const fixtureNow = Date.UTC(2026, 7, 21, 9, 30)

/**
 * Deterministic in-memory login adapter. Every response is produced locally so `/demo/login/**`
 * requires no backend, authentication, or network access.
 */
export function loginDemoAdapterCreate(options: {
  readonly fixtureState: () => DemoFixtureState
  readonly onResume: () => void
}): LoginAdapter {
  const failing = () => options.fixtureState() === "error"
  const fail = (op: string, message: string, code: `${string}.${string}`) => resultErrorCodedCreate(op, message, code)
  const challenge = () => ({
    challenge: {
      expiresAt: fixtureNow + 300_000,
      id: "demo-mfa-challenge",
      purpose: "login" as const,
      requiredAssurance: "multi_factor" as const,
    },
    token: "demo-mfa-token-abcdefghijklmnopqrstuvwxyz0123456789abcdef",
  })
  const authenticated = (withChallenge: boolean) =>
    resultCreate(withChallenge ? { challenge: challenge(), userId: "demo-user" } : { userId: "demo-user" })

  return {
    discover: async () => {
      // Discovery stays successful for the `error` state so submission failures render in-form
      // rather than replacing the whole page; `/demo/login/unsupported` covers discovery failure.
      if (options.fixtureState() === "loading") return new Promise<never>(() => undefined)
      return resultCreate(demoLoginBootstrap)
    },
    emailOtpStart: async () => {
      if (failing()) return fail("loginDemoEmailOtpStart", "The email code could not be sent.", "email-otp.invalid")
      return resultCreate({
        accepted: true as const,
        challengeId: "demo-email-challenge",
        expiresAt: fixtureNow + 600_000,
        retryAt: fixtureNow + 30_000,
      })
    },
    emailOtpVerify: async () => {
      if (failing()) return fail("loginDemoEmailOtpVerify", "The email code is incorrect.", "email-otp.unauthorized")
      return authenticated(options.fixtureState() === "expired")
    },
    interactionResume: options.onResume,
    logout: async () => {
      if (failing()) return fail("loginDemoLogout", "The session could not be ended.", "sessions.invalid")
      return resultCreate({ revoked: true })
    },
    mfaComplete: async () => {
      if (failing()) return fail("loginDemoMfaComplete", "The verification code is incorrect.", "mfa.unauthorized")
      return authenticated(false)
    },
    mfaTotpEnrollConfirm: async () => {
      if (failing()) return fail("loginDemoTotpConfirm", "The verification code is incorrect.", "mfa.unauthorized")
      return resultCreate({ confirmed: true as const })
    },
    mfaTotpEnrollStart: async () => {
      if (failing()) return fail("loginDemoTotpStart", "The authenticator setup is unavailable.", "mfa.invalid")
      return resultCreate({
        enrollment: {
          confirmedAt: null,
          id: "demo-enrollment",
          label: "Authenticator app",
          status: "pending" as const,
          userId: "demo-user",
        },
        otpauthUri: "otpauth://totp/Acme:alex@acme.example?secret=JBSWY3DPEHPK3PXP&issuer=Acme",
        secret: "JBSWY3DPEHPK3PXP",
      })
    },
    passkeyAuthenticate: async () => {
      if (failing()) return fail("loginDemoPasskey", "The passkey could not be verified.", "passkeys.unauthorized")
      return authenticated(false)
    },
    passkeySupported: () => options.fixtureState() !== "permission-denied",
    passwordChange: async () => {
      if (failing()) return fail("loginDemoPasswordChange", "The password could not be updated.", "passwords.invalid")
      return resultCreate({ changed: true as const })
    },
    passwordLogin: async () => {
      if (failing())
        return fail("loginDemoPasswordLogin", "The identifier or password is incorrect.", "passwords.unauthorized")
      return authenticated(options.fixtureState() === "expired")
    },
    providerStart: async () => {
      if (failing())
        return fail(
          "loginDemoProviderStart",
          "Sign-in with this provider could not be started.",
          "external-identities.invalid",
        )
      return resultCreate({ authorizationUrl: "https://accounts.example/authorize?demo=1" })
    },
    recentAccounts: async () => resultCreate(options.fixtureState() === "empty" ? [] : demoLoginRecentAccounts),
    recoveryComplete: async () => {
      if (failing())
        return fail("loginDemoRecoveryComplete", "The recovery link is no longer valid.", "passwords.invalid")
      return resultCreate({ changed: true as const })
    },
    recoveryRequest: async () => {
      if (failing())
        return fail("loginDemoRecoveryRequest", "Recovery instructions could not be sent.", "passwords.invalid")
      return resultCreate({ accepted: true as const })
    },
    register: async () => {
      if (failing()) return fail("loginDemoRegister", "This account could not be created.", "passwords.conflict")
      return resultCreate({ verificationRequired: true as const })
    },
    verifyEmail: async () => {
      if (failing())
        return fail("loginDemoVerifyEmail", "This confirmation link is no longer valid.", "passwords.invalid")
      return resultCreate({ email: "alex@acme.example" })
    },
  }
}
