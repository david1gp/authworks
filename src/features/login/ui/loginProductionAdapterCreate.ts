import * as v from "valibot"
import type { Result } from "#result"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { passkeyAuthenticationRun } from "../../passkeys/ui/passkeyAuthenticationRun.js"
import { passkeyCapabilityCheck } from "../../passkeys/ui/passkeyCapabilityCheck.js"
import type { LoginRecentAccount } from "../model/loginRecentAccountSchema.js"
import { loginRecentAccountSchema } from "../model/loginRecentAccountSchema.js"
import { loginReturnPathSelect } from "../model/loginReturnPathSelect.js"
import type { LoginAdapter, LoginAuthenticationOutcome, LoginDiscovery } from "./loginAdapter.js"
import type { loginApiCreate } from "./loginApiCreate.js"

type LoginProductionAdapterOptions = {
  readonly api: ReturnType<typeof loginApiCreate>
  readonly discovery: () => LoginDiscovery | undefined
  readonly discoverySet: (discovery: LoginDiscovery) => void
  readonly domain: string
  readonly interactionHandle: () => string | undefined
  readonly interactionResume: () => void
  readonly returnTo?: () => string | null
}

const notDiscovered = (op: string) =>
  resultErrorCodedCreate(op, "The sign-in request could not be prepared.", "organizations.not-found")

/**
 * Binds the shared login state to real browser clients. The realm is always taken from runtime
 * discovery, never from a hardcoded identifier.
 */
export function loginProductionAdapterCreate(options: LoginProductionAdapterOptions): LoginAdapter {
  const api = options.api
  const realmId = () => options.discovery()?.organization.realmId
  const organizationId = () => options.discovery()?.organization.id
  let whatsappAvailable = false
  let challengeToken: string | undefined
  const challengeRecord = (outcome: LoginAuthenticationOutcome): LoginAuthenticationOutcome => {
    if (outcome.challenge !== undefined) challengeToken = outcome.challenge.token
    return outcome
  }
  const challengeTokenRequired = (op: string): Result<string> =>
    challengeToken === undefined
      ? resultErrorCodedCreate(
          op,
          "The verification challenge is no longer available. Start sign-in again.",
          "mfa.invalid",
        )
      : resultCreate(challengeToken)

  return {
    discover: async () => {
      whatsappAvailable = false
      const result = await api.discover(options.domain)
      if (!result.success) return result
      if (!result.data.found) return notDiscovered("loginDiscover")
      if (result.data.policy.allowWhatsappOtp === true) {
        const availability = await api.whatsappOtpAvailabilityGet(
          result.data.organization.realmId,
          result.data.organization.id,
        )
        whatsappAvailable = availability.success && availability.data.available
      }
      options.discoverySet(result.data)
      return resultCreate(result.data)
    },
    emailOtpStart: async (email) => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginEmailOtpStart")
      return api.emailOtpStart(realm, email, organizationId())
    },
    emailOtpVerify: async (challengeId, code) => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginEmailOtpVerify")
      const result = await api.emailOtpVerify(realm, challengeId, code, organizationId())
      if (!result.success) return result
      return resultCreate(
        challengeRecord({ challenge: result.data.challenge, userId: result.data.authentication.userId }),
      )
    },
    interactionResume: options.interactionResume,
    logout: async () => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginLogout")
      const result = await api.logout(realm)
      if (!result.success) return result
      return resultCreate({ revoked: true })
    },
    mfaChallengeTokenSet: (token: string) => {
      challengeToken = token
    },
    mfaEmailOtpEnroll: async () => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginMfaEmailOtpEnroll")
      const token = challengeTokenRequired("loginMfaEmailOtpEnroll")
      if (!token.success) return token
      // Enrolling an email second factor is the same login-scoped challenge start as verifying:
      // it delivers a code to the verified account email, and completing the challenge proves
      // control of that address. No separate enroll contract exists on the backend.
      return api.mfaEmailOtpChallengeStart(realm, token.data)
    },
    mfaEmailOtpResend: async () => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginMfaEmailOtpResend")
      const token = challengeTokenRequired("loginMfaEmailOtpResend")
      if (!token.success) return token
      // The challenge email start is replay-safe: within the cooldown it returns the pending
      // challenge instead of sending a duplicate, so it doubles as the resend transport.
      return api.mfaEmailOtpChallengeStart(realm, token.data)
    },
    mfaEmailOtpStart: async () => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginMfaEmailOtpStart")
      const token = challengeTokenRequired("loginMfaEmailOtpStart")
      if (!token.success) return token
      return api.mfaEmailOtpChallengeStart(realm, token.data)
    },
    mfaEmailOtpVerify: async (_challengeId, code) => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginMfaEmailOtpVerify")
      const token = challengeTokenRequired("loginMfaEmailOtpVerify")
      if (!token.success) return token
      const result = await api.mfaChallengeComplete(realm, token.data, code)
      if (!result.success) return result
      return resultCreate(
        challengeRecord({ challenge: result.data.challenge, userId: result.data.authentication.userId }),
      )
    },
    mfaPasskeyAuthenticate: async (passkeyOptions) => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginMfaPasskeyAuthenticate")
      const token = challengeTokenRequired("loginMfaPasskeyAuthenticate")
      if (!token.success) {
        passkeyOptions?.statusSet?.("failure")
        return token
      }
      passkeyOptions?.statusSet?.("pending")
      const start = await api.mfaPasskeyLoginStart(realm, token.data)
      if (!start.success) {
        passkeyOptions?.statusSet?.("failure")
        return start
      }
      const ceremony = await passkeyAuthenticationRun(start.data, passkeyOptions)
      if (!ceremony.success) return ceremony
      const completed = await api.mfaPasskeyLoginComplete(realm, ceremony.data)
      if (!completed.success) {
        passkeyOptions?.statusSet?.("failure")
        return completed
      }
      passkeyOptions?.statusSet?.("ready")
      return resultCreate(
        challengeRecord({ challenge: completed.data.challenge, userId: completed.data.authentication.userId }),
      )
    },
    mfaComplete: async (token, code) => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginMfaComplete")
      const result = await api.mfaChallengeComplete(realm, token, code)
      if (!result.success) return result
      return resultCreate(
        challengeRecord({ challenge: result.data.challenge, userId: result.data.authentication.userId }),
      )
    },
    mfaTotpEnrollConfirm: async (enrollmentId, code) => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginMfaTotpEnrollConfirm")
      const result = await api.mfaTotpEnrollConfirm(realm, enrollmentId, code)
      if (!result.success) return result
      return resultCreate({ confirmed: true as const })
    },
    mfaTotpEnrollStart: async () => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginMfaTotpEnrollStart")
      return api.mfaTotpEnrollStart(realm)
    },
    passkeyAuthenticate: async (passkeyOptions) => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginPasskeyAuthenticate")
      passkeyOptions?.statusSet?.("pending")
      const start = await api.passkeyAuthenticationStart(realm, organizationId())
      if (!start.success) {
        passkeyOptions?.statusSet?.("failure")
        return start
      }
      const ceremony = await passkeyAuthenticationRun(start.data, passkeyOptions)
      if (!ceremony.success) return ceremony
      const completed = await api.passkeyAuthenticationComplete(realm, ceremony.data)
      if (!completed.success) {
        passkeyOptions?.statusSet?.("failure")
        return completed
      }
      passkeyOptions?.statusSet?.("ready")
      return resultCreate(
        challengeRecord({ challenge: completed.data.challenge, userId: completed.data.authentication.userId }),
      )
    },
    passkeySupported: passkeyCapabilityCheck,
    passwordChange: async (currentPassword, newPassword) => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginPasswordChange")
      const result = await api.passwordMeChange(realm, currentPassword, newPassword)
      if (!result.success) return result
      return resultCreate({ changed: true as const })
    },
    passwordLogin: async (identifier, password) => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginPasswordLogin")
      const result = await api.passwordLogin(realm, identifier, password, organizationId())
      if (!result.success) return result
      return resultCreate(
        challengeRecord({
          challenge: result.data.challenge,
          ...(result.data.passwordChangeRequired === true ? { passwordChangeRequired: true as const } : {}),
          userId: result.data.authentication.userId,
        }),
      )
    },
    providerStart: async (providerId) => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginProviderStart")
      const handle = options.interactionHandle()
      const result = await api.providerStart(realm, providerId, {
        ...(handle === undefined ? {} : { interaction: handle }),
        ...(organizationId() === undefined ? {} : { organizationId: organizationId() as string }),
      })
      if (!result.success) return result
      try {
        globalThis.location.assign(result.data.authorizationUrl)
      } catch {
        return resultErrorCodedCreate(
          "loginProviderStart",
          "The external identity provider is unavailable.",
          "external-identities.read-failed",
        )
      }
      return resultCreate({ authorizationUrl: result.data.authorizationUrl })
    },
    recentAccounts: async () => {
      const realm = realmId()
      if (realm === undefined) return resultCreate([] as readonly LoginRecentAccount[])
      const result = await api.recentList(realm)
      if (!result.success) return resultCreate([] as readonly LoginRecentAccount[])
      const identifiers = new Set<string>()
      const accounts: LoginRecentAccount[] = []
      for (const session of result.data.items) {
        if (session.loginIdentifier === undefined || identifiers.has(session.loginIdentifier)) continue
        const parsed = v.safeParse(loginRecentAccountSchema, {
          authenticationMethod: session.authenticationMethod,
          identifier: session.loginIdentifier,
          label: session.label,
          lastUsedAt: session.lastUsedAt,
          sessionId: session.id,
        })
        if (!parsed.success) continue
        identifiers.add(session.loginIdentifier)
        accounts.push(parsed.output)
      }
      return resultCreate(accounts)
    },
    recentAccountResume: async (sessionId) => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginRecentAccountResume")
      const result = await api.recentResume(realm, sessionId, organizationId())
      if (!result.success) return result
      return resultCreate({ resumed: true as const })
    },
    recoveryComplete: async (token, newPassword) => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginRecoveryComplete")
      return api.recoveryComplete(realm, token, newPassword)
    },
    recoveryRequest: async (email) => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginRecoveryRequest")
      return api.recoveryRequest(realm, email, organizationId())
    },
    register: async (input) => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginRegister")
      const returnTo = loginReturnPathSelect(options.returnTo?.(), "")
      const result = await api.register(realm, {
        ...(returnTo.length === 0 ? {} : { returnTo }),
        email: input.email,
        password: input.password,
        profile: { displayName: input.displayName },
        userName: input.userName,
        ...(organizationId() === undefined ? {} : { organizationId: organizationId() as string }),
      })
      if (!result.success) return result
      return resultCreate({ verificationRequired: true as const })
    },
    verifyEmail: async (token) => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginVerifyEmail")
      const result = await api.verifyEmail(realm, token)
      if (!result.success) return result
      return resultCreate({ email: result.data.user.email })
    },
    whatsappOtpAvailable: () => whatsappAvailable,
    whatsappOtpResend: async (challengeId) => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginWhatsappOtpResend")
      return api.whatsappOtpResend(realm, challengeId, organizationId())
    },
    whatsappOtpStart: async (phoneNumber) => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginWhatsappOtpStart")
      return api.whatsappOtpStart(realm, phoneNumber, organizationId())
    },
    whatsappOtpVerify: async (challengeId, code) => {
      const realm = realmId()
      if (realm === undefined) return notDiscovered("loginWhatsappOtpVerify")
      const result = await api.whatsappOtpVerify(realm, challengeId, code, organizationId())
      if (!result.success) return result
      return resultCreate(
        challengeRecord({ challenge: result.data.challenge, userId: result.data.authentication.userId }),
      )
    },
  }
}
