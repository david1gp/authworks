import { onMount } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import { loginPrimaryMethodsGet } from "../model/loginPrimaryMethodsGet.js"
import type { LoginRecentAccount } from "../model/loginRecentAccountSchema.js"
import { loginScreenPathGet } from "../model/loginScreenPathGet.js"
import type { LoginScreen } from "../model/loginScreenSchema.js"
import type { LoginAdapter, LoginAuthenticationOutcome, LoginDiscovery } from "./loginAdapter.js"
import type { LoginViewStatus } from "./loginViewStatusSchema.js"

type LoginPageStateOptions = {
  readonly adapter: LoginAdapter
  readonly basePath: string
  readonly navigate: (path: string) => void
  readonly recoveryToken?: () => string
  readonly screen: () => LoginScreen
  readonly verificationToken?: () => string
}

/**
 * Shared hosted-login behaviour. Every production and demo page binds this factory to an adapter,
 * so screen transitions, validation, and error wording stay identical across both.
 */
export function loginPageStateCreate(options: LoginPageStateOptions) {
  const status = createSignalObject<LoginViewStatus>("loading")
  const discovery = createSignalObject<LoginDiscovery | undefined>(undefined)
  const errorMessage = createSignalObject<string | undefined>(undefined)
  const validationMessage = createSignalObject<string | undefined>(undefined)
  const pending = createSignalObject(false)
  const identifier = createSignalObject("")
  const password = createSignalObject("")
  const revealPassword = createSignalObject(false)
  const email = createSignalObject("")
  const code = createSignalObject("")
  const newPassword = createSignalObject("")
  const confirmPassword = createSignalObject("")
  const displayName = createSignalObject("")
  const userName = createSignalObject("")
  const challengeId = createSignalObject("")
  const challengeToken = createSignalObject("")
  const resendAt = createSignalObject(0)
  const recentAccounts = createSignalObject<readonly LoginRecentAccount[]>([])
  const totpSecret = createSignalObject<{ readonly enrollmentId: string; readonly secret: string } | undefined>(
    undefined,
  )

  const go = (screen: LoginScreen) => {
    errorMessage.set(undefined)
    validationMessage.set(undefined)
    code.set("")
    options.navigate(loginScreenPathGet(screen, options.basePath))
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
  const run = async <T>(operation: () => Promise<{ success: boolean; data?: T; errorMessage?: string }>) => {
    pending.set(true)
    errorMessage.set(undefined)
    validationMessage.set(undefined)
    const result = await operation()
    pending.set(false)
    if (!result.success) {
      fail(result.errorMessage ?? messageTranslate("common.error"))
      return undefined
    }
    return result.data as T
  }
  const authenticationApply = (outcome: LoginAuthenticationOutcome) => {
    if (outcome.challenge !== undefined) {
      challengeToken.set(outcome.challenge.token)
      go("mfa")
      return
    }
    options.adapter.interactionResume()
  }

  const load = async () => {
    status.set("loading")
    errorMessage.set(undefined)
    const result = await options.adapter.discover()
    if (!result.success) {
      errorMessage.set(result.errorMessage)
      status.set("unavailable")
      return
    }
    discovery.set(result.data)
    status.set("ready")
    if (options.screen() === "recent-accounts") {
      const recent = await options.adapter.recentAccounts()
      if (recent.success) recentAccounts.set(recent.data)
    }
  }

  const passwordSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (identifier.get().trim().length === 0 || password.get().length === 0)
      return invalid(messageTranslate("login.error.credentialsRequired"))
    const outcome = await run(() => options.adapter.passwordLogin(identifier.get().trim(), password.get()))
    if (outcome !== undefined) authenticationApply(outcome)
  }
  const passwordChangeSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (newPassword.get().length < 8) return invalid(messageTranslate("login.error.passwordTooShort"))
    if (newPassword.get() !== confirmPassword.get()) return invalid(messageTranslate("login.error.passwordMismatch"))
    const changed = await run(() => options.adapter.passwordChange(password.get(), newPassword.get()))
    if (changed !== undefined) options.adapter.interactionResume()
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
      email.set(verified.email)
      status.set("verified")
    }
  }
  const emailOtpSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (options.screen() === "email-otp") {
      if (!email.get().includes("@")) return invalid(messageTranslate("login.error.emailRequired"))
      const started = await run(() => options.adapter.emailOtpStart(email.get().trim()))
      if (started === undefined) return
      challengeId.set(started.challengeId)
      resendAt.set(started.retryAt)
      go("email-otp-code")
      return
    }
    if (challengeId.get().length === 0) {
      // The code step was opened directly, so no challenge exists for this browser yet.
      go("email-otp")
      return
    }
    if (!/^\d{6}$/.test(code.get())) return invalid(messageTranslate("login.error.codeRequired"))
    const outcome = await run(() => options.adapter.emailOtpVerify(challengeId.get(), code.get()))
    if (outcome !== undefined) authenticationApply(outcome)
  }
  const emailOtpResend = async () => {
    const started = await run(() => options.adapter.emailOtpStart(email.get().trim()))
    if (started === undefined) return
    challengeId.set(started.challengeId)
    resendAt.set(started.retryAt)
  }
  const mfaSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const value = code.get().trim().toUpperCase()
    const recovery = options.screen() === "mfa-recovery-code"
    if (recovery ? !/^[A-Z0-9-]{8,64}$/.test(value) : !/^\d{6}$/.test(value))
      return invalid(messageTranslate(recovery ? "login.error.recoveryCodeRequired" : "login.error.codeRequired"))
    const outcome = await run(() => options.adapter.mfaComplete(challengeToken.get(), value))
    if (outcome !== undefined) options.adapter.interactionResume()
  }
  const totpEnrollStart = async () => {
    const started = await run(() => options.adapter.mfaTotpEnrollStart())
    if (started === undefined) return
    totpSecret.set({ enrollmentId: started.enrollment.id, secret: started.secret })
  }
  const totpEnrollSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const setup = totpSecret.get()
    if (setup === undefined) return invalid(messageTranslate("login.error.enrollmentMissing"))
    if (!/^\d{6}$/.test(code.get())) return invalid(messageTranslate("login.error.codeRequired"))
    const confirmed = await run(() => options.adapter.mfaTotpEnrollConfirm(setup.enrollmentId, code.get()))
    if (confirmed !== undefined) options.adapter.interactionResume()
  }
  const passkeyAuthenticate = async () => {
    const outcome = await run(() => options.adapter.passkeyAuthenticate())
    if (outcome !== undefined) authenticationApply(outcome)
  }
  const providerStart = async (providerId: string) => {
    await run(() => options.adapter.providerStart(providerId))
  }
  const recoverySubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (!email.get().includes("@")) return invalid(messageTranslate("login.error.emailRequired"))
    const requested = await run(() => options.adapter.recoveryRequest(email.get().trim()))
    if (requested !== undefined) go("recovery-sent")
  }
  const recoveryResetSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    const token = options.recoveryToken?.() ?? ""
    if (token.length === 0) return invalid(messageTranslate("login.error.tokenMissing"))
    if (newPassword.get().length < 8) return invalid(messageTranslate("login.error.passwordTooShort"))
    if (newPassword.get() !== confirmPassword.get()) return invalid(messageTranslate("login.error.passwordMismatch"))
    const completed = await run(() => options.adapter.recoveryComplete(token, newPassword.get()))
    if (completed !== undefined) go("recovery-complete")
  }
  const logout = async () => {
    const revoked = await run(() => options.adapter.logout())
    if (revoked !== undefined) go("logout-done")
  }
  const recentAccountSelect = (account: LoginRecentAccount | undefined) => {
    identifier.set(account?.identifier ?? "")
    go("password")
  }

  onMount(() => void load())

  return {
    challengeToken,
    code,
    confirmPassword,
    discovery: discovery.get,
    displayName,
    email,
    emailOtpResend,
    emailOtpSubmit,
    errorMessage: errorMessage.get,
    go,
    identifier,
    load: () => void load(),
    logout,
    methods: () => {
      const found = discovery.get()
      return found === undefined ? [] : loginPrimaryMethodsGet(found.policy, found.providers.length)
    },
    mfaSubmit,
    newPassword,
    passkeyAuthenticate,
    passkeySupported: options.adapter.passkeySupported,
    password,
    passwordChangeSubmit,
    passwordSubmit,
    pending: pending.get,
    providerStart,
    recentAccounts: recentAccounts.get,
    recentAccountSelect,
    recoveryResetSubmit,
    recoverySubmit,
    registerSubmit,
    resendAt: resendAt.get,
    revealPassword,
    screen: options.screen,
    status: status.get,
    totpEnrollStart,
    totpEnrollSubmit,
    totpSecret: totpSecret.get,
    userName,
    validationMessage: validationMessage.get,
    verifyEmailSubmit,
  }
}

export type LoginPageState = ReturnType<typeof loginPageStateCreate>
