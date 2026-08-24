import { createEffect, onCleanup, onMount } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { emailOtpCodeNormalize } from "../../emailOtp/model/emailOtpCodeNormalize.js"
import { emailOtpResendCountdownGet } from "../../emailOtp/model/emailOtpResendCountdownGet.js"
import type { ExternalIdentityLoginStatus } from "../../externalIdentities/public/externalIdentityLoginStatusSchema.js"
import type { ExternalIdentityLoginSubroute } from "../../externalIdentities/public/externalIdentityLoginSubrouteSchema.js"
import { mfaCodeNormalize } from "../../mfa/model/mfaCodeNormalize.js"
import type { MfaFactor } from "../../mfa/model/mfaFactorSchema.js"
import type { MfaEmailOtpStage } from "../../mfa/ui/mfaEmailOtpStageSchema.js"
import type { PasskeyAuthenticationStatus } from "../../passkeys/public/passkeyAuthenticationStatusSchema.js"
import { loginIdentifierNormalize } from "../model/loginIdentifierNormalize.js"
import { loginPreferenceLoad } from "../model/loginPreferenceLoad.js"
import { loginPreferenceSave } from "../model/loginPreferenceSave.js"
import type { LoginPreference } from "../model/loginPreferenceSchema.js"
import { loginPrimaryMethodsGet } from "../model/loginPrimaryMethodsGet.js"
import { loginProviderPathGet } from "../model/loginProviderPathGet.js"
import type { LoginRecentAccount } from "../model/loginRecentAccountSchema.js"
import { loginScreenPathGet } from "../model/loginScreenPathGet.js"
import type { LoginScreen } from "../model/loginScreenSchema.js"
import type { LoginAdapter, LoginAuthenticationOutcome, LoginDiscovery } from "./loginAdapter.js"
import type { LoginViewStatus } from "./loginViewStatusSchema.js"

type LoginPageStateOptions = {
  readonly adapter: LoginAdapter
  readonly basePath: string
  readonly clearToken?: () => void
  readonly defaultPreference?: () => LoginPreference
  readonly initialDiscovery?: () => LoginDiscovery | undefined
  readonly initialEmailOtpNotice?: () => string | undefined
  readonly initialErrorMessage?: () => string | undefined
  readonly initialPasskeyStatus?: () => PasskeyAuthenticationStatus | undefined
  readonly initialMfaSetupUnavailable?: () => boolean
  readonly initialProviderId?: () => string | undefined
  readonly initialProviderSubroute?: () => ExternalIdentityLoginSubroute | undefined
  readonly initialStatus?: () => LoginViewStatus | undefined
  readonly navigate: (path: string) => void
  readonly passwordChangeExpired?: () => boolean
  readonly recoveryToken?: () => string
  readonly recoveryRequestStep?: () => "loading" | "email" | "sent" | "fatal"
  readonly recoveryResetInitialStep?: () => "loading" | "ready" | "invalid-link" | "complete"
  readonly screen: () => LoginScreen
  readonly storage?: Storage
  readonly verificationToken?: () => string
}

/**
 * Shared hosted-login behaviour. Every production and demo page binds this factory to an adapter,
 * so screen transitions, validation, and error wording stay identical across both.
 */
export function loginPageStateCreate(options: LoginPageStateOptions) {
  const initialDiscovery = options.initialDiscovery?.()
  const initialStatus = options.initialStatus?.()
  const status = createSignalObject<LoginViewStatus>(initialStatus ?? "loading")
  const activeScreen = createSignalObject<LoginScreen>(options.screen())
  const discovery = createSignalObject<LoginDiscovery | undefined>(initialDiscovery)
  const errorMessage = createSignalObject<string | undefined>(undefined)
  const validationMessage = createSignalObject<string | undefined>(undefined)
  const pending = createSignalObject(false)
  const identifier = createSignalObject("")
  const password = createSignalObject("")
  const revealPassword = createSignalObject(false)
  const rememberIdentifier = createSignalObject(false)
  const email = createSignalObject("")
  const code = createSignalObject("")
  const newPassword = createSignalObject("")
  const confirmPassword = createSignalObject("")
  const recoveryResetStep = createSignalObject<"loading" | "ready" | "invalid-link" | "complete">(
    options.recoveryResetInitialStep?.() ?? "ready",
  )
  const displayName = createSignalObject("")
  const userName = createSignalObject("")
  const challengeId = createSignalObject("")
  const challengeToken = createSignalObject("")
  const selectedProviderId = createSignalObject<string | undefined>(options.initialProviderId?.())
  const resendAt = createSignalObject(0)
  const resendCountdown = createSignalObject(0)
  const emailOtpNotice = createSignalObject<string | undefined>(undefined)
  const recentAccounts = createSignalObject<readonly LoginRecentAccount[]>([])
  const totpSecret = createSignalObject<{ readonly enrollmentId: string; readonly secret: string } | undefined>(
    undefined,
  )
  const totpSetup = createSignalObject<
    { readonly enrollmentId: string; readonly otpauthUri: string; readonly secret: string } | undefined
  >(undefined)
  const providerStatus = createSignalObject<ExternalIdentityLoginStatus>(options.initialProviderSubroute?.() ?? "ready")
  const passkeyStatus = createSignalObject<PasskeyAuthenticationStatus>(
    options.initialPasskeyStatus?.() ?? (options.screen() === "mfa-passkey" ? "mfa-continuation" : "ready"),
  )
  const mfaEmailOtpChallengeId = createSignalObject("")
  const mfaEmailOtpResendAt = createSignalObject(0)
  const mfaEmailOtpResendCountdown = createSignalObject(0)
  const mfaEmailOtpNotice = createSignalObject<string | undefined>(undefined)
  const mfaSetupUnavailable = () => options.initialMfaSetupUnavailable?.() ?? false
  let identifierInput: HTMLInputElement | undefined
  let passwordInput: HTMLInputElement | undefined
  let emailOtpEmailInput: HTMLInputElement | undefined
  let emailOtpCodeInput: HTMLInputElement | undefined
  let preferenceOrganizationId: string | undefined
  let preferenceTimer: ReturnType<typeof setTimeout> | undefined
  let preferenceIdleCallback: number | undefined
  let resendTimer: ReturnType<typeof setTimeout> | undefined
  let mfaEmailOtpResendTimer: ReturnType<typeof setTimeout> | undefined
  let lifecycleHeading: HTMLHeadingElement | undefined
  let requestedScreen: LoginScreen | undefined
  let synchronizedRouteScreen = activeScreen.get()
  let screenFocusRequest = 0
  let lifecycleHeadingFocusRequest = 0

  const preferenceStorage = () => {
    if (options.storage !== undefined) return options.storage
    if (typeof localStorage === "undefined") return undefined
    return localStorage
  }
  const preferenceCancel = () => {
    if (preferenceTimer !== undefined) {
      clearTimeout(preferenceTimer)
      preferenceTimer = undefined
    }
    if (preferenceIdleCallback !== undefined && typeof window !== "undefined" && "cancelIdleCallback" in window) {
      window.cancelIdleCallback(preferenceIdleCallback)
      preferenceIdleCallback = undefined
    }
  }
  const preferenceValue = (): LoginPreference => {
    const normalizedIdentifier = loginIdentifierNormalize(identifier.get())
    const normalizedEmail = loginIdentifierNormalize(email.get())
    return {
      ...(rememberIdentifier.get() && normalizedEmail.length > 0 ? { email: normalizedEmail } : {}),
      ...(rememberIdentifier.get() && normalizedIdentifier.length > 0 ? { identifier: normalizedIdentifier } : {}),
      rememberIdentifier: rememberIdentifier.get(),
      updatedAt: Date.now(),
      version: 1,
    }
  }
  const preferenceSaveNow = () => {
    const storage = preferenceStorage()
    if (storage === undefined || preferenceOrganizationId === undefined) return
    loginPreferenceSave(storage, preferenceOrganizationId, preferenceValue())
  }
  const preferenceSchedule = () => {
    preferenceCancel()
    preferenceTimer = setTimeout(() => {
      preferenceTimer = undefined
      const save = () => {
        preferenceIdleCallback = undefined
        preferenceSaveNow()
      }
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        preferenceIdleCallback = window.requestIdleCallback(save, { timeout: 500 })
        return
      }
      save()
    }, 180)
  }
  const preferenceLoad = (organizationId: string) => {
    if (preferenceOrganizationId === organizationId) return
    preferenceOrganizationId = organizationId
    const storage = preferenceStorage()
    if (storage !== undefined) {
      const loaded = loginPreferenceLoad(storage, organizationId)
      if (loaded.success && loaded.data !== undefined) {
        rememberIdentifier.set(loaded.data.rememberIdentifier)
        if (identifier.get().length === 0 && loaded.data.identifier !== undefined)
          identifier.set(loaded.data.identifier)
        if (email.get().length === 0 && (options.screen() === "email-otp" || options.screen() === "email-otp-code"))
          email.set(loaded.data.email ?? loaded.data.identifier ?? "")
        return
      }
    }
    const defaultPreference = options.defaultPreference?.()
    if (defaultPreference === undefined) return
    rememberIdentifier.set(defaultPreference.rememberIdentifier)
    if (identifier.get().length === 0 && defaultPreference.identifier !== undefined)
      identifier.set(defaultPreference.identifier)
    if (email.get().length === 0 && (options.screen() === "email-otp" || options.screen() === "email-otp-code"))
      email.set(defaultPreference.email ?? defaultPreference.identifier ?? "")
  }
  onCleanup(preferenceCancel)

  const resendTimerStop = () => {
    if (resendTimer === undefined) return
    clearTimeout(resendTimer)
    resendTimer = undefined
  }
  const resendCountdownUpdate = () => {
    resendTimerStop()
    const remaining = emailOtpResendCountdownGet(resendAt.get())
    resendCountdown.set(remaining)
    if (remaining > 0) resendTimer = setTimeout(resendCountdownUpdate, 1_000)
  }
  const resendAtSet = (nextRetryAt: number) => {
    resendAt.set(nextRetryAt)
    resendCountdownUpdate()
  }

  const mfaEmailOtpResendTimerStop = () => {
    if (mfaEmailOtpResendTimer === undefined) return
    clearTimeout(mfaEmailOtpResendTimer)
    mfaEmailOtpResendTimer = undefined
  }
  const mfaEmailOtpResendCountdownUpdate = () => {
    mfaEmailOtpResendTimerStop()
    const remaining = emailOtpResendCountdownGet(mfaEmailOtpResendAt.get())
    mfaEmailOtpResendCountdown.set(remaining)
    if (remaining > 0) mfaEmailOtpResendTimer = setTimeout(mfaEmailOtpResendCountdownUpdate, 1_000)
  }
  const mfaEmailOtpResendAtSet = (nextRetryAt: number) => {
    mfaEmailOtpResendAt.set(nextRetryAt)
    mfaEmailOtpResendCountdownUpdate()
  }

  const go = (screen: LoginScreen) => {
    requestedScreen = screen === synchronizedRouteScreen ? undefined : screen
    activeScreen.set(screen)
    errorMessage.set(undefined)
    validationMessage.set(undefined)
    code.set("")
    emailOtpNotice.set(undefined)
    mfaEmailOtpNotice.set(undefined)
    if (screen === "provider") providerStatus.set(options.initialProviderSubroute?.() ?? "ready")
    if (screen === "passkey") passkeyStatus.set("ready")
    if (screen === "mfa-passkey") passkeyStatus.set("mfa-continuation")
    const selectedProvider = selectedProviderId.get()
    options.navigate(
      screen === "provider" && selectedProvider !== undefined
        ? loginProviderPathGet(selectedProvider, options.basePath)
        : loginScreenPathGet(screen, options.basePath),
    )
  }
  const fail = (message: string) => {
    errorMessage.set(message)
    status.set("ready")
    pending.set(false)
  }
  const invalid = (message: string) => {
    validationMessage.set(message)
    pending.set(false)
  }
  const run = async <T>(
    operation: () => Promise<{ success: boolean; data?: T; errorMessage?: string; code?: string; statusCode?: number }>,
    failureMessage?: (result: {
      readonly errorMessage?: string
      readonly code?: string
      readonly statusCode?: number
    }) => string | undefined,
  ) => {
    pending.set(true)
    errorMessage.set(undefined)
    validationMessage.set(undefined)
    const result = await operation()
    pending.set(false)
    if (!result.success) {
      fail(failureMessage?.(result) ?? result.errorMessage ?? messageTranslate("common.error"))
      return undefined
    }
    return result.data as T
  }
  const interactionContinue = () => {
    status.set("continuing")
    pending.set(false)
    options.adapter.interactionResume()
  }

  const authenticationApply = (outcome: LoginAuthenticationOutcome) => {
    if (outcome.challenge !== undefined) {
      challengeToken.set(outcome.challenge.token)
      go("mfa")
      return
    }
    interactionContinue()
  }

  const load = async () => {
    const alreadyDiscovered = discovery.get()
    if (alreadyDiscovered !== undefined) {
      status.set("ready")
      preferenceLoad(alreadyDiscovered.organization.id)
      errorMessage.set(options.initialErrorMessage?.())
      emailOtpNotice.set(options.initialEmailOtpNotice?.())
      const recent = await options.adapter.recentAccounts()
      if (recent.success) recentAccounts.set(recent.data)
      return
    }
    status.set("loading")
    errorMessage.set(undefined)
    const result = await options.adapter.discover()
    if (!result.success) {
      errorMessage.set(result.errorMessage)
      status.set("fatal")
      return
    }
    discovery.set(result.data)
    preferenceLoad(result.data.organization.id)
    errorMessage.set(options.initialErrorMessage?.())
    emailOtpNotice.set(options.initialEmailOtpNotice?.())
    status.set("ready")
    const recent = await options.adapter.recentAccounts()
    if (recent.success) recentAccounts.set(recent.data)
  }

  const passwordSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    errorMessage.set(undefined)
    validationMessage.set(undefined)
    const normalizedIdentifier = loginIdentifierNormalize(identifier.get())
    identifier.set(normalizedIdentifier)
    if (normalizedIdentifier.length === 0) {
      invalid(messageTranslate("login.error.identifierRequired"))
      queueMicrotask(() => identifierInput?.focus())
      return
    }
    if (password.get().length === 0) {
      invalid(messageTranslate("login.error.passwordRequired"))
      queueMicrotask(() => passwordInput?.focus())
      return
    }
    const submittedPassword = password.get()
    password.set("")
    preferenceSchedule()
    const outcome = await run(() => options.adapter.passwordLogin(normalizedIdentifier, submittedPassword))
    if (outcome === undefined) {
      queueMicrotask(() => passwordInput?.focus())
      return
    }
    if (outcome !== undefined) authenticationApply(outcome)
  }
  const passwordChangeSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (password.get().length === 0) return invalid(messageTranslate("login.password.currentRequired"))
    if (newPassword.get().length === 0) return invalid(messageTranslate("login.error.newPasswordRequired"))
    if (newPassword.get().length < 8) return invalid(messageTranslate("login.error.passwordTooShort"))
    if (newPassword.get() !== confirmPassword.get()) return invalid(messageTranslate("login.error.passwordMismatch"))
    const submittedCurrentPassword = password.get()
    const submittedNewPassword = newPassword.get()
    const changed = await run(() => options.adapter.passwordChange(submittedCurrentPassword, submittedNewPassword))
    password.set("")
    newPassword.set("")
    confirmPassword.set("")
    if (changed !== undefined) interactionContinue()
  }
  const registerSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (!email.get().includes("@")) return invalid(messageTranslate("login.error.emailRequired"))
    if (displayName.get().trim().length === 0) return invalid(messageTranslate("login.error.nameRequired"))
    if (newPassword.get().length < 8) return invalid(messageTranslate("login.error.passwordTooShort"))
    if (newPassword.get() !== confirmPassword.get()) return invalid(messageTranslate("login.error.passwordMismatch"))
    const registered = await run(() =>
      options.adapter.register({
        displayName: displayName.get().trim(),
        email: email.get().trim(),
        password: newPassword.get(),
        userName: userName.get().trim().length === 0 ? email.get().trim() : userName.get().trim(),
      }),
    )
    if (registered !== undefined) go("register-done")
  }
  const verifyEmailSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const token = options.verificationToken?.() ?? ""
    if (token.length === 0) return invalid(messageTranslate("login.error.tokenMissing"))
    const verified = await run(() => options.adapter.verifyEmail(token))
    if (verified !== undefined) {
      options.clearToken?.()
      email.set(verified.email)
      status.set("verified")
    }
  }
  const emailOtpSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    errorMessage.set(undefined)
    validationMessage.set(undefined)
    emailOtpNotice.set(undefined)
    if (options.screen() === "email-otp") {
      const normalizedEmail = loginIdentifierNormalize(email.get())
      email.set(normalizedEmail)
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))
        return invalid(messageTranslate("login.error.emailRequired"))
      // The reference persists a changed remembered email before starting the request. Keep this
      // organization-scoped write at the same interaction point so a fast demo transition cannot
      // outrun the debounced preference enhancement.
      preferenceSaveNow()
      const started = await run(() => options.adapter.emailOtpStart(normalizedEmail))
      if (started === undefined) {
        queueMicrotask(() => emailOtpEmailInput?.focus())
        return
      }
      challengeId.set(started.challengeId)
      resendAtSet(started.retryAt)
      go("email-otp-code")
      emailOtpNotice.set(messageTranslate("login.emailOtp.resent"))
      queueMicrotask(() => emailOtpCodeInput?.focus())
      return
    }
    if (challengeId.get().length === 0) {
      // The code step was opened directly, so no challenge exists for this browser yet.
      go("email-otp")
      return
    }
    if (!/^\d{6}$/.test(code.get())) {
      invalid(messageTranslate("login.error.codeRequired"))
      queueMicrotask(() => emailOtpCodeInput?.focus())
      return
    }
    const submittedCode = code.get()
    code.set("")
    const outcome = await run(() => options.adapter.emailOtpVerify(challengeId.get(), submittedCode))
    if (outcome === undefined) {
      queueMicrotask(() => emailOtpCodeInput?.focus())
      return
    }
    authenticationApply(outcome)
  }
  const emailOtpResend = async () => {
    if (!emailOtpResendAllowed()) return
    errorMessage.set(undefined)
    validationMessage.set(undefined)
    emailOtpNotice.set(undefined)
    const started = await run(() => options.adapter.emailOtpStart(loginIdentifierNormalize(email.get())))
    if (started === undefined) {
      queueMicrotask(() => emailOtpCodeInput?.focus())
      return
    }
    challengeId.set(started.challengeId)
    resendAtSet(started.retryAt)
    emailOtpNotice.set(messageTranslate("login.emailOtp.resent"))
    queueMicrotask(() => emailOtpCodeInput?.focus())
  }
  const emailOtpResendAllowed = () => challengeId.get().length > 0 && resendCountdown.get() === 0 && !pending.get()
  const mfaSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (options.screen() === "mfa-email-otp-code") return mfaEmailOtpSubmit(event)
    const kind = options.screen() === "mfa-recovery-code" ? "recovery-code" : "totp"
    const value = mfaCodeNormalize(kind, code.get())
    code.set(value)
    const recovery = options.screen() === "mfa-recovery-code"
    if (recovery ? !/^[A-Z0-9-]{8,64}$/.test(value) : !/^\d{6}$/.test(value))
      return invalid(messageTranslate(recovery ? "login.error.recoveryCodeRequired" : "login.error.codeRequired"))
    const outcome = await run(() => options.adapter.mfaComplete(challengeToken.get(), value))
    if (outcome !== undefined) interactionContinue()
  }
  const totpEnrollStart = async () => {
    if (mfaSetupUnavailable()) return fail(messageTranslate("login.totpEnroll.unavailableDescription"))
    const started = await run(() => options.adapter.mfaTotpEnrollStart())
    if (started === undefined) return
    totpSecret.set({ enrollmentId: started.enrollment.id, secret: started.secret })
    totpSetup.set({ enrollmentId: started.enrollment.id, otpauthUri: started.otpauthUri, secret: started.secret })
  }
  const totpEnrollSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const setup = totpSecret.get()
    if (setup === undefined) return invalid(messageTranslate("login.error.enrollmentMissing"))
    const value = mfaCodeNormalize("totp", code.get())
    code.set(value)
    if (!/^\d{6}$/.test(value)) return invalid(messageTranslate("login.error.codeRequired"))
    const confirmed = await run(() => options.adapter.mfaTotpEnrollConfirm(setup.enrollmentId, value))
    if (confirmed !== undefined) interactionContinue()
  }
  const mfaEmailOtpStart = async (enrollment: boolean) => {
    const operation = enrollment ? options.adapter.mfaEmailOtpEnroll : options.adapter.mfaEmailOtpStart
    if (operation === undefined) {
      fail(messageTranslate("login.mfa.emailOtpUnavailableNotice"))
      return
    }
    const started = await run(operation)
    if (started === undefined) return
    mfaEmailOtpChallengeId.set(started.challengeId)
    mfaEmailOtpResendAtSet(started.retryAt)
    go("mfa-email-otp-code")
    mfaEmailOtpNotice.set(messageTranslate(enrollment ? "login.mfa.emailOtpEnrollSent" : "login.mfa.emailOtpSent"))
  }
  const mfaEmailOtpSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const value = mfaCodeNormalize("email-otp", code.get())
    code.set(value)
    if (!/^\d{6}$/.test(value)) return invalid(messageTranslate("login.error.codeRequired"))
    const verify = options.adapter.mfaEmailOtpVerify
    if (verify === undefined) {
      fail(messageTranslate("login.mfa.emailOtpUnavailableNotice"))
      return
    }
    const outcome = await run(() => verify(mfaEmailOtpChallengeId.get(), value))
    if (outcome !== undefined) interactionContinue()
  }
  const mfaEmailOtpResend = async () => {
    const resend = options.adapter.mfaEmailOtpResend
    if (resend === undefined || mfaEmailOtpChallengeId.get().length === 0 || mfaEmailOtpResendCountdown.get() > 0)
      return
    code.set("")
    const started = await run(() => resend(mfaEmailOtpChallengeId.get()))
    if (started === undefined) return
    mfaEmailOtpChallengeId.set(started.challengeId)
    mfaEmailOtpResendAtSet(started.retryAt)
    mfaEmailOtpNotice.set(messageTranslate("login.mfa.emailOtpResent"))
  }
  const mfaPasskeyAuthenticate = async () => {
    const authenticate = options.adapter.mfaPasskeyAuthenticate
    if (authenticate === undefined) {
      passkeyStatus.set("unsupported")
      fail(messageTranslate("login.mfa.passkeyUnavailableNotice"))
      return
    }
    passkeyStatus.set("pending")
    const outcome = await run(() => authenticate({ statusSet: passkeyStatus.set }))
    if (outcome === undefined) {
      if (passkeyStatus.get() === "pending" || passkeyStatus.get() === "ready") passkeyStatus.set("failure")
      return
    }
    interactionContinue()
  }
  const mfaEmailOtpEnroll = () => mfaEmailOtpStart(true)
  const mfaMode = () => {
    const screen = options.screen()
    if (screen === "mfa-loading") return "loading" as const
    if (screen === "mfa-options-unavailable") return "unavailable" as const
    if (screen === "mfa-enroll") return "enroll" as const
    if (screen === "mfa-optional") return "optional" as const
    if (screen === "mfa-satisfied") return "satisfied" as const
    return "select" as const
  }
  const mfaFactors = (): readonly MfaFactor[] => ["totp", "email-otp", "passkey", "recovery-code"]
  const mfaFactorAvailability = (): Partial<Record<MfaFactor, boolean>> => ({
    "email-otp": options.adapter.mfaEmailOtpStart !== undefined,
    passkey: options.adapter.mfaPasskeyAuthenticate !== undefined,
    "recovery-code": true,
    totp: true,
  })
  const passkeyAuthenticate = async () => {
    if (!options.adapter.passkeySupported()) {
      passkeyStatus.set("unsupported")
      fail(messageTranslate("login.passkey.unsupported"))
      return
    }
    passkeyStatus.set("pending")
    preferenceSaveNow()
    const outcome = await run(() =>
      options.adapter.passkeyAuthenticate({
        statusSet: passkeyStatus.set,
      }),
    )
    if (outcome === undefined) {
      const currentStatus = passkeyStatus.get()
      if (currentStatus === "pending" || currentStatus === "ready") passkeyStatus.set("failure")
      if (currentStatus === "permission-denied") errorMessage.set(messageTranslate("common.error"))
      if (currentStatus === "ceremony-failure") errorMessage.set(messageTranslate("common.error"))
      return
    }
    if (outcome.challenge !== undefined) passkeyStatus.set("mfa-continuation")
    authenticationApply(outcome)
  }
  const providerStart = async (providerId: string) => {
    providerStatus.set("pending")
    const started = await run(() => options.adapter.providerStart(providerId))
    if (started === undefined) {
      providerStatus.set("failure")
      return
    }
    providerStatus.set("ready")
  }
  const providerSelect = (providerId: string) => {
    if (discovery.get()?.providers.some((provider) => provider.id === providerId)) {
      selectedProviderId.set(providerId)
      providerStatus.set("ready")
    }
  }
  const recoverySubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const normalizedEmail = loginIdentifierNormalize(email.get())
    email.set(normalizedEmail)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))
      return invalid(messageTranslate("login.error.emailRecoveryRequired"))
    const requested = await run(() => options.adapter.recoveryRequest(email.get().trim()))
    if (requested !== undefined) {
      email.set("")
      go("recovery-sent")
    }
  }
  const recoveryResetSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const token = options.recoveryToken?.() ?? ""
    if (token.length === 0) {
      recoveryResetStep.set("invalid-link")
      newPassword.set("")
      confirmPassword.set("")
      return invalid(messageTranslate("login.recovery.invalidLinkError"))
    }
    if (newPassword.get().length === 0) return invalid(messageTranslate("login.error.newPasswordRequired"))
    if (newPassword.get().length < 8) return invalid(messageTranslate("login.error.passwordTooShort"))
    if (newPassword.get() !== confirmPassword.get()) return invalid(messageTranslate("login.error.passwordMismatch"))
    const completed = await run(
      () => options.adapter.recoveryComplete(token, newPassword.get()),
      (result) => {
        if (result.code !== "passwords.invalid" && result.statusCode !== 409) return undefined
        recoveryResetStep.set("invalid-link")
        return messageTranslate("login.recovery.invalidLinkError")
      },
    )
    if (completed !== undefined) {
      options.clearToken?.()
      newPassword.set("")
      confirmPassword.set("")
      recoveryResetStep.set("complete")
      go("recovery-complete")
      return
    }
    if (recoveryResetStep.get() === "invalid-link") {
      newPassword.set("")
      confirmPassword.set("")
    }
  }
  const logout = async () => {
    const revoked = await run(() => options.adapter.logout())
    if (revoked !== undefined) go("logout-done")
  }
  const recentAccountSelect = (account: LoginRecentAccount | undefined) => {
    identifier.set(account?.identifier ?? "")
    if (account !== undefined) {
      rememberIdentifier.set(true)
      preferenceSchedule()
    }
    go("password")
  }

  onMount(() => {
    if (initialStatus !== undefined && discovery.get() === undefined) return
    void load()
  })
  createEffect(() => {
    const routeScreen = options.screen()
    if (requestedScreen !== undefined) {
      if (routeScreen !== requestedScreen) return
      requestedScreen = undefined
    }
    if (routeScreen === synchronizedRouteScreen) return
    synchronizedRouteScreen = routeScreen
    activeScreen.set(routeScreen)
  })
  createEffect(() => {
    const currentScreen = activeScreen.get()
    if (currentScreen === "recovery-reset") recoveryResetStep.set(options.recoveryResetInitialStep?.() ?? "ready")
    if (currentScreen === "recovery-complete") recoveryResetStep.set("complete")
  })
  createEffect(() => {
    const screen = activeScreen.get()
    const focusRequest = ++screenFocusRequest
    if (screen !== "email-otp" && screen !== "email-otp-code") return
    queueMicrotask(() => {
      if (focusRequest !== screenFocusRequest || activeScreen.get() !== screen) return
      if (screen === "email-otp") emailOtpEmailInput?.focus()
      if (screen === "email-otp-code") emailOtpCodeInput?.focus()
    })
  })
  createEffect(() => {
    const currentStatus = status.get()
    const focusRequest = ++lifecycleHeadingFocusRequest
    if (currentStatus !== "loading" && currentStatus !== "continuing" && currentStatus !== "fatal") return
    queueMicrotask(() => {
      if (focusRequest !== lifecycleHeadingFocusRequest || status.get() !== currentStatus) return
      lifecycleHeading?.focus()
    })
  })
  onCleanup(resendTimerStop)
  onCleanup(mfaEmailOtpResendTimerStop)

  return {
    challengeToken,
    code,
    confirmPassword,
    discovery: discovery.get,
    displayName,
    email,
    emailOtpResend,
    emailOtpResendAllowed,
    emailOtpResendCountdown: resendCountdown.get,
    emailOtpSubmit,
    emailOtpNotice: emailOtpNotice.get,
    errorMessage: errorMessage.get,
    go,
    identifier,
    identifierInputRegister: (element: HTMLInputElement) => {
      identifierInput = element
    },
    lifecycleHeadingRegister: (element: HTMLHeadingElement) => {
      lifecycleHeading = element
    },
    load: () => void load(),
    logout,
    methods: () => {
      const found = discovery.get()
      return found === undefined ? [] : loginPrimaryMethodsGet(found.policy, found.providers.length)
    },
    mfaSubmit,
    mfaCodeInputMode: () => (options.screen() === "mfa-recovery-code" ? "text" : "numeric"),
    mfaCodeSet: (value: string) => {
      const kind = options.screen() === "mfa-recovery-code" ? "recovery-code" : "totp"
      code.set(mfaCodeNormalize(kind, value))
    },
    mfaCodeValid: () => {
      const value = code.get()
      return options.screen() === "mfa-recovery-code" ? /^[A-Z0-9-]{8,64}$/.test(value) : /^\d{6}$/.test(value)
    },
    mfaEmailOtpAvailable: () => options.adapter.mfaEmailOtpStart !== undefined,
    mfaEmailOtpEnroll,
    mfaEmailOtpNotice: mfaEmailOtpNotice.get,
    mfaEmailOtpResend,
    mfaEmailOtpResendCountdown: mfaEmailOtpResendCountdown.get,
    mfaEmailOtpSend: () => mfaEmailOtpStart(options.screen() === "mfa-email-otp-enroll"),
    mfaEmailOtpStage: (): MfaEmailOtpStage =>
      options.screen() === "mfa-email-otp-enroll"
        ? "enroll"
        : options.screen() === "mfa-email-otp-code"
          ? "code"
          : "send",
    mfaFactors,
    mfaFactorAvailability,
    mfaMode,
    mfaOptionsRetry: () => go("mfa"),
    mfaPasskeyAvailable: () => options.adapter.mfaPasskeyAuthenticate !== undefined,
    mfaPasskeyAuthenticate,
    newPassword,
    passkeyAuthenticate,
    passkeyStatus: passkeyStatus.get,
    passkeySupported: options.adapter.passkeySupported,
    password,
    passwordInputRegister: (element: HTMLInputElement) => {
      passwordInput = element
    },
    passwordValid: () => identifier.get().trim().length > 0 && password.get().length > 0,
    passwordChangeSubmit,
    passwordChangeExpired: () => options.passwordChangeExpired?.() ?? false,
    passwordSubmit,
    pending: pending.get,
    providerStart,
    provider: () => {
      const found = discovery.get()
      const selected = selectedProviderId.get()
      if (selected !== undefined) return found?.providers.find((provider) => provider.id === selected)
      return found?.providers[0]
    },
    providerStatus: providerStatus.get,
    providerSelect,
    recentAccounts: recentAccounts.get,
    recentAccountSelect,
    recoveryRequestStep: () =>
      options.recoveryRequestStep?.() ?? (discovery.get()?.policy.allowPasswordRecovery === false ? "fatal" : "email"),
    recoveryResetSubmit,
    recoveryResetStep: recoveryResetStep.get,
    recoverySubmit,
    registerSubmit,
    resendAt: resendAt.get,
    revealPassword,
    rememberIdentifier: rememberIdentifier.get,
    rememberIdentifierChange: (event: Event & { readonly currentTarget: HTMLInputElement }) => {
      rememberIdentifier.set(event.currentTarget.checked)
      preferenceSchedule()
    },
    screen: activeScreen.get,
    status: status.get,
    totpEnrollStart,
    totpEnrollSubmit,
    totpSecret: totpSecret.get,
    totpSetup: totpSetup.get,
    totpSetupUnavailable: mfaSetupUnavailable,
    userName,
    validationMessage: validationMessage.get,
    verifyEmailSubmit,
    emailOtpEmailInputRegister: (element: HTMLInputElement) => {
      emailOtpEmailInput = element
    },
    emailOtpCodeInputRegister: (element: HTMLInputElement) => {
      emailOtpCodeInput = element
    },
    emailOtpCodeSet: (value: string) => code.set(emailOtpCodeNormalize(value)),
    emailOtpChangeEmail: () => {
      code.set("")
      challengeId.set("")
      resendAtSet(0)
      emailOtpNotice.set(undefined)
      errorMessage.set(undefined)
      validationMessage.set(undefined)
      options.navigate(loginScreenPathGet("email-otp", options.basePath))
      queueMicrotask(() => emailOtpEmailInput?.focus())
    },
  }
}

export type LoginPageState = ReturnType<typeof loginPageStateCreate>
