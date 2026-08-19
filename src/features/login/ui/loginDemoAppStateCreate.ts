import { useLocation, useNavigate } from "@solidjs/router"
import { onCleanup, onMount } from "solid-js"
import * as v from "valibot"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { emailOtpStartRequestSchema } from "../../emailOtp/public/emailOtpStartRequestSchema.js"
import { emailOtpVerifyRequestSchema } from "../../emailOtp/public/emailOtpVerifyRequestSchema.js"
import { externalIdentityStartRequestSchema } from "../../externalIdentities/public/externalIdentityStartRequestSchema.js"
import { mfaChallengeCompleteRequestSchema } from "../../mfa/public/mfaChallengeCompleteRequestSchema.js"
import { mfaTotpEnrollmentConfirmRequestSchema } from "../../mfa/public/mfaTotpEnrollmentConfirmRequestSchema.js"
import { passkeyAuthenticationStartRequestSchema } from "../../passkeys/public/passkeyAuthenticationStartRequestSchema.js"
import { passwordLoginRequestSchema } from "../../passwords/public/passwordLoginRequestSchema.js"
import { passwordRecoveryCompleteRequestSchema } from "../../passwords/public/passwordRecoveryCompleteRequestSchema.js"
import { passwordRecoveryRequestSchema } from "../../passwords/public/passwordRecoveryRequestSchema.js"
import { demoLoginBootstrap } from "../../demo/demoLoginBootstrap.js"
import { demoLoginScenarioSchema } from "../../demo/demoLoginScenarioSchema.js"
import { loginPrimaryMethodsGet } from "../model/loginPrimaryMethodsGet.js"

const chromeSchema = v.picklist(["sidebar", "compact"])

export function loginDemoAppStateCreate() {
  const location = useLocation()
  const navigate = useNavigate()
  const identifier = createSignalObject("alex@example.com")
  const password = createSignalObject("")
  const email = createSignalObject("alex@example.com")
  const code = createSignalObject("")
  const newPassword = createSignalObject("")
  const rememberIdentifier = createSignalObject(false)
  const revealPassword = createSignalObject(false)
  const otpStep = createSignalObject<"email" | "code">(location.pathname.endsWith("/code") ? "code" : "email")
  const resendSeconds = createSignalObject(0)
  const error = createSignalObject<string | undefined>(undefined)
  const completed = createSignalObject(false)
  const chrome = createSignalObject(chromeValueGet(location.search))

  const timer = window.setInterval(() => {
    if (resendSeconds.get() > 0) resendSeconds.set(resendSeconds.get() - 1)
  }, 1000)
  onCleanup(() => window.clearInterval(timer))
  onMount(() => chrome.set(chromeValueGet(location.search)))

  const scenario = () => {
    const parsed = v.safeParse(demoLoginScenarioSchema, location.pathname)
    return parsed.success ? parsed.output : "/demo/login"
  }
  const go = (path: string) => {
    error.set(undefined)
    completed.set(false)
    otpStep.set(path.endsWith("/code") ? "code" : "email")
    navigate(path)
  }
  const onPasswordSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    const result = v.safeParse(passwordLoginRequestSchema, {
      identifier: identifier.get(),
      organizationId: demoLoginBootstrap.organization.id,
      password: password.get(),
    })
    if (!result.success) {
      error.set("Enter an email and password to continue.")
      return
    }
    if (scenario() === "/demo/login/password/error") {
      error.set("The identifier or password is incorrect.")
      return
    }
    completed.set(true)
  }
  const onEmailOtpSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    if (otpStep.get() === "email") {
      const result = v.safeParse(emailOtpStartRequestSchema, {
        email: email.get(),
        organizationId: demoLoginBootstrap.organization.id,
      })
      if (!result.success) {
        error.set("Enter a valid email address.")
        return
      }
      otpStep.set("code")
      resendSeconds.set(30)
      error.set(undefined)
      return
    }
    const result = v.safeParse(emailOtpVerifyRequestSchema, {
      challengeId: "demo-email-challenge",
      code: code.get(),
      organizationId: demoLoginBootstrap.organization.id,
    })
    if (!result.success) {
      error.set("Enter the six-digit verification code.")
      return
    }
    completed.set(true)
  }
  const onMfaSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    const result = v.safeParse(mfaChallengeCompleteRequestSchema, {
      code: code.get(),
      token: "demo-mfa-token-abcdefghijklmnopqrstuvwxyz1234567890",
    })
    if (!result.success) {
      error.set("Enter the six-digit verification code.")
      return
    }
    completed.set(true)
  }
  const onEnrollSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    const result = v.safeParse(mfaTotpEnrollmentConfirmRequestSchema, {
      code: code.get(),
      enrollmentId: "demo-enrollment",
    })
    if (!result.success) {
      error.set("Enter the six-digit verification code.")
      return
    }
    completed.set(true)
  }
  const onRecoverySubmit = (event: SubmitEvent) => {
    event.preventDefault()
    const result = v.safeParse(passwordRecoveryRequestSchema, {
      email: email.get(),
      organizationId: demoLoginBootstrap.organization.id,
    })
    if (!result.success) {
      error.set("Enter a valid email address.")
      return
    }
    go("/demo/login/password/forgot/sent")
  }
  const onResetSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    const result = v.safeParse(passwordRecoveryCompleteRequestSchema, {
      newPassword: newPassword.get(),
      token: "demo-recovery-token-abcdefghijklmnopqrstuvwxyz",
    })
    if (!result.success) {
      error.set("Choose a password to complete the reset.")
      return
    }
    go("/demo/login/password/reset/complete")
  }
  const onChangeRequiredSubmit = (event: SubmitEvent) => {
    event.preventDefault()
    if (newPassword.get().length < 1) {
      error.set("Choose a new password.")
      return
    }
    completed.set(true)
  }
  const onPasskey = () => {
    const result = v.safeParse(passkeyAuthenticationStartRequestSchema, {
      organizationId: demoLoginBootstrap.organization.id,
    })
    if (!result.success) {
      error.set("Passkey sign-in could not start.")
      return
    }
    completed.set(true)
  }
  const onExternalIdentity = () => {
    const result = v.safeParse(externalIdentityStartRequestSchema, {
      organizationId: demoLoginBootstrap.organization.id,
    })
    if (!result.success) {
      error.set("External sign-in could not start.")
      return
    }
    if (scenario() === "/demo/login/idp/failure") {
      error.set("Google sign-in could not be completed.")
      return
    }
    completed.set(true)
  }
  const toggleChrome = () => {
    const next = chrome.get() === "sidebar" ? "compact" : "sidebar"
    chrome.set(next)
    const url = new URL(window.location.href)
    url.searchParams.set("chrome", next)
    window.history.replaceState({}, "", url)
  }
  return {
    bootstrap: demoLoginBootstrap,
    chrome: chrome.get,
    code: code.get,
    completed: completed.get,
    email: email.get,
    error: error.get,
    go,
    identifier: identifier.get,
    methods: loginPrimaryMethodsGet(demoLoginBootstrap.policy, demoLoginBootstrap.providers.length),
    newPassword: newPassword.get,
    onChangeRequiredSubmit,
    onCode: code.set,
    onEmail: email.set,
    onEmailOtpSubmit,
    onEnrollSubmit,
    onExternalIdentity,
    onForgot: () => go("/demo/login/password/forgot"),
    onIdentifier: identifier.set,
    onMfaSubmit,
    onNewPassword: newPassword.set,
    onPassword: password.set,
    onPasskey,
    onPasswordSubmit,
    password: password.get,
    onRecoverySubmit,
    onRememberIdentifier: rememberIdentifier.set,
    onResend: () => resendSeconds.get() === 0 && resendSeconds.set(30),
    onResetSubmit,
    onRevealPassword: () => revealPassword.set(!revealPassword.get()),
    onSelectMethod: (method: "password" | "email-otp" | "passkey" | "external-identity") =>
      go(`/demo/login/${method === "external-identity" ? "idp" : method}`),
    onToggleChrome: toggleChrome,
    otpStep: otpStep.get,
    rememberIdentifier: rememberIdentifier.get,
    resendSeconds: resendSeconds.get,
    revealPassword: revealPassword.get,
    scenario,
  }
}

function chromeValueGet(search: string): "sidebar" | "compact" {
  const value = new URLSearchParams(search).get("chrome")
  const result = v.safeParse(chromeSchema, value ?? "sidebar")
  return result.success ? result.output : "sidebar"
}
