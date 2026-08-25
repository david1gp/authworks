import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { englishCatalog } from "../../../ui/i18n/model/englishCatalog.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { demoLoginBootstrap } from "../../demo/demoLoginBootstrap.js"
import { demoLoginRecentAccounts } from "../../demo/demoLoginRecentAccounts.js"
import type { PasskeyAuthenticationStatus } from "../../passkeys/public/passkeyAuthenticationStatusSchema.js"
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
  const emailOtpWait = () => new Promise<void>((resolve) => setTimeout(resolve, 280))
  const passwordLoginWait = () => new Promise<void>((resolve) => setTimeout(resolve, 280))
  const recentAccountResumeWait = () => new Promise<void>((resolve) => setTimeout(resolve, 280))
  const recoveryRequestWait = () => new Promise<void>((resolve) => setTimeout(resolve, 280))
  const providerWait = () => new Promise<void>((resolve) => setTimeout(resolve, 280))
  const passkeyWait = () => new Promise<void>((resolve) => setTimeout(resolve, 280))
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
      if (options.fixtureState() === "fatal")
        return fail("loginDemoDiscover", "The sign-in request could not be initialized.", "platform.internal")
      return resultCreate(demoLoginBootstrap)
    },
    emailOtpStart: async () => {
      await emailOtpWait()
      if (failing()) return fail("loginDemoEmailOtpStart", "The email code could not be sent.", "email-otp.invalid")
      const now = Date.now()
      return resultCreate({
        accepted: true as const,
        challengeId: "demo-email-challenge",
        expiresAt: now + 600_000,
        retryAt: now + 60_000,
      })
    },
    emailOtpVerify: async () => {
      await emailOtpWait()
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
    mfaEmailOtpEnroll: async () => {
      await emailOtpWait()
      if (failing())
        return fail("loginDemoMfaEmailOtpEnroll", "Email verification setup is unavailable.", "mfa.invalid")
      const now = Date.now()
      return resultCreate({
        accepted: true as const,
        challengeId: "demo-mfa-email-enrollment",
        expiresAt: now + 600_000,
        retryAt: now + 60_000,
      })
    },
    mfaEmailOtpResend: async () => {
      await emailOtpWait()
      if (failing()) return fail("loginDemoMfaEmailOtpResend", "The email code could not be sent.", "mfa.invalid")
      const now = Date.now()
      return resultCreate({
        accepted: true as const,
        challengeId: "demo-mfa-email-challenge",
        expiresAt: now + 600_000,
        retryAt: now + 60_000,
      })
    },
    mfaEmailOtpStart: async () => {
      await emailOtpWait()
      if (failing()) return fail("loginDemoMfaEmailOtpStart", "The email code could not be sent.", "mfa.invalid")
      const now = Date.now()
      return resultCreate({
        accepted: true as const,
        challengeId: "demo-mfa-email-challenge",
        expiresAt: now + 600_000,
        retryAt: now + 60_000,
      })
    },
    mfaEmailOtpVerify: async () => {
      await emailOtpWait()
      if (failing()) return fail("loginDemoMfaEmailOtpVerify", "The email code is incorrect.", "mfa.unauthorized")
      return authenticated(false)
    },
    mfaPasskeyAuthenticate: async (input?: { readonly statusSet?: (status: PasskeyAuthenticationStatus) => void }) => {
      input?.statusSet?.("pending")
      await passkeyWait()
      if (options.fixtureState() === "passkey-permission-denied" || options.fixtureState() === "permission-denied") {
        input?.statusSet?.("permission-denied")
        return fail("loginDemoMfaPasskey", "Passkey sign-in was canceled or timed out.", "passkeys.invalid")
      }
      if (options.fixtureState() === "passkey-ceremony-failure") {
        input?.statusSet?.("ceremony-failure")
        return fail(
          "loginDemoMfaPasskey",
          "Passkey sign-in could not be completed. Please try again.",
          "passkeys.invalid",
        )
      }
      if (failing()) {
        input?.statusSet?.("failure")
        return fail("loginDemoMfaPasskey", "The passkey could not be verified.", "mfa.unauthorized")
      }
      input?.statusSet?.("ready")
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
    passkeyAuthenticate: async (input?: { readonly statusSet?: (status: PasskeyAuthenticationStatus) => void }) => {
      input?.statusSet?.("pending")
      if (options.fixtureState() === "loading" || options.fixtureState() === "passkey-pending") await passkeyWait()
      if (options.fixtureState() === "passkey-permission-denied" || options.fixtureState() === "permission-denied") {
        input?.statusSet?.("permission-denied")
        return fail("loginDemoPasskey", "Passkey sign-in was canceled or timed out.", "passkeys.invalid")
      }
      if (options.fixtureState() === "passkey-ceremony-failure") {
        input?.statusSet?.("ceremony-failure")
        return fail("loginDemoPasskey", "Passkey sign-in could not be completed. Please try again.", "passkeys.invalid")
      }
      if (failing()) {
        input?.statusSet?.("failure")
        return fail("loginDemoPasskey", "The passkey could not be verified.", "passkeys.unauthorized")
      }
      if (options.fixtureState() === "mfa-continuation") {
        input?.statusSet?.("mfa-continuation")
        return authenticated(true)
      }
      input?.statusSet?.("ready")
      return authenticated(false)
    },
    passkeySupported: () =>
      options.fixtureState() !== "passkey-unsupported" && options.fixtureState() !== "permission-denied",
    passwordChange: async () => {
      if (failing()) return fail("loginDemoPasswordChange", "The password could not be updated.", "passwords.invalid")
      return resultCreate({ changed: true as const })
    },
    passwordLogin: async () => {
      await passwordLoginWait()
      if (failing())
        return fail(
          "loginDemoPasswordLogin",
          englishCatalog["login.error.credentialsInvalid"],
          "passwords.unauthorized",
        )
      return authenticated(options.fixtureState() === "expired")
    },
    providerStart: async () => {
      if (options.fixtureState() === "loading") await providerWait()
      if (failing())
        return fail(
          "loginDemoProviderStart",
          "Sign-in with this provider could not be started.",
          "external-identities.invalid",
        )
      return resultCreate({ authorizationUrl: "https://accounts.example/authorize?demo=1" })
    },
    recentAccounts: async () => resultCreate(options.fixtureState() === "empty" ? [] : demoLoginRecentAccounts),
    recentAccountResume: async () => {
      await recentAccountResumeWait()
      if (failing())
        return fail("loginDemoRecentAccountResume", "The remembered account could not be resumed.", "sessions.invalid")
      return resultCreate({ resumed: true as const })
    },
    recoveryComplete: async () => {
      if (failing())
        return fail("loginDemoRecoveryComplete", "The recovery link is no longer valid.", "passwords.invalid")
      return resultCreate({ changed: true as const })
    },
    recoveryRequest: async () => {
      await recoveryRequestWait()
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
    whatsappOtpAvailable: () => true,
    whatsappOtpResend: async () => {
      await emailOtpWait()
      if (failing())
        return fail("loginDemoWhatsappOtpResend", "The WhatsApp code could not be sent.", "whatsapp-otp.invalid")
      return resultCreate({
        accepted: true as const,
        challengeId: "demo-whatsapp-challenge",
        expiresAt: fixtureNow + 600_000,
        retryAt: fixtureNow + 60_000,
      })
    },
    whatsappOtpStart: async () => {
      await emailOtpWait()
      if (failing())
        return fail("loginDemoWhatsappOtpStart", "The WhatsApp code could not be sent.", "whatsapp-otp.invalid")
      return resultCreate({
        accepted: true as const,
        challengeId: "demo-whatsapp-challenge",
        expiresAt: fixtureNow + 600_000,
        retryAt: fixtureNow + 60_000,
      })
    },
    whatsappOtpVerify: async () => {
      await emailOtpWait()
      if (failing())
        return fail("loginDemoWhatsappOtpVerify", "The WhatsApp code is incorrect.", "whatsapp-otp.invalid")
      return authenticated(options.fixtureState() === "expired")
    },
  }
}
