import * as v from "valibot"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import {
  type ExternalIdentityLoginSubroute,
  externalIdentityLoginSubrouteSchema,
} from "../../externalIdentities/public/externalIdentityLoginSubrouteSchema.js"
import { type LoginScreen, loginScreenSchema } from "./loginScreenSchema.js"

type LoginPathResolution = {
  readonly providerId?: string
  readonly screen: LoginScreen
  readonly state?: DemoFixtureState
  readonly providerSubroute?: ExternalIdentityLoginSubroute
}

/**
 * Maps a hosted login sub-path onto its screen. Legacy `/demo/login` paths that encoded an outcome
 * additionally resolve the fixture state they were named after.
 */
const loginPathTable: Readonly<Record<string, LoginPathResolution>> = {
  "": { screen: "chooser" },
  "/chooser": { screen: "chooser" },
  "/chooser/recent-accounts": { screen: "recent-accounts" },
  "/continuing": { screen: "loading", state: "continuing" },
  "/email-otp": { screen: "email-otp" },
  "/email-otp/code": { screen: "email-otp-code" },
  "/idp": { screen: "provider" },
  "/idp/failure": { screen: "provider", providerSubroute: "failure", state: "error" },
  "/idp/account-not-found": { screen: "provider", providerSubroute: "account-not-found" },
  "/idp/linking-failed": { screen: "provider", providerSubroute: "linking-failed" },
  "/idp/registration-failed": { screen: "provider", providerSubroute: "registration-failed" },
  "/fatal": { screen: "loading", state: "fatal" },
  "/loading": { screen: "loading" },
  "/logout": { screen: "logout" },
  "/logout/done": { screen: "logout-done" },
  "/mfa": { screen: "mfa" },
  "/mfa/email-otp": { screen: "mfa-email-otp" },
  "/mfa/email-otp/enroll": { screen: "mfa-email-otp-enroll" },
  "/mfa/email-otp/code": { screen: "mfa-email-otp-code" },
  "/mfa/enroll": { screen: "mfa-enroll", state: "mfa-enroll" },
  "/mfa/loading": { screen: "mfa-loading", state: "mfa-loading" },
  "/mfa/optional": { screen: "mfa-optional", state: "mfa-optional" },
  "/mfa/retry": { screen: "mfa-options-unavailable", state: "mfa-retry" },
  "/mfa/passkey": { screen: "mfa-passkey" },
  "/mfa/passkey/enroll": { screen: "mfa-passkey-enroll", state: "mfa-setup-unavailable" },
  "/mfa/recovery-code": { screen: "mfa-recovery-code" },
  "/mfa/satisfied": { screen: "mfa-satisfied", state: "mfa-satisfied" },
  "/mfa/totp": { screen: "mfa-totp" },
  "/mfa/totp-enroll": { screen: "mfa-totp-enroll" },
  "/mfa/totp-enroll/unavailable": { screen: "mfa-totp-enroll", state: "mfa-setup-unavailable" },
  "/passkey": { screen: "passkey" },
  "/passkey/unsupported": { screen: "passkey", state: "passkey-unsupported" },
  "/passkey/permission-denied": { screen: "passkey", state: "passkey-permission-denied" },
  "/passkey/ceremony-failure": { screen: "passkey", state: "passkey-ceremony-failure" },
  "/passkey/pending": { screen: "passkey", state: "passkey-pending" },
  "/password": { screen: "password" },
  "/password/change-required": { screen: "password-change-required" },
  "/password/change-required/expired": { screen: "password-change-required", state: "password-change-expired" },
  "/password/error": { screen: "password", state: "error" },
  "/password/forgot": { screen: "recovery-request" },
  "/password/forgot/loading": { screen: "recovery-request", state: "recovery-loading" },
  "/password/forgot/sent": { screen: "recovery-sent" },
  "/password/forgot/unavailable": { screen: "recovery-request", state: "recovery-fatal" },
  "/password/reset": { screen: "recovery-reset" },
  "/password/reset/complete": { screen: "recovery-complete" },
  "/password/reset/invalid": { screen: "recovery-reset", state: "reset-invalid" },
  "/password/reset/loading": { screen: "recovery-reset", state: "reset-loading" },
  "/register": { screen: "register" },
  "/register/done": { screen: "register-done" },
  "/signed-in": { screen: "signed-in" },
  "/unsupported": { screen: "unsupported" },
  "/verify-email": { screen: "verify-email" },
}

export function loginPathResolve(pathname: string, basePath: string): LoginPathResolution | undefined {
  if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return undefined
  const suffix = pathname.slice(basePath.length).replace(/\/+$/, "")
  const resolved = loginPathTable[suffix]
  if (resolved !== undefined) {
    if (!v.safeParse(loginScreenSchema, resolved.screen).success) return undefined
    return resolved
  }
  const providerMatch = suffix.match(
    /^\/idp\/([^/]+)(?:\/(failure|account-not-found|linking-failed|registration-failed))?$/,
  )
  if (providerMatch?.[1] === undefined) return undefined
  let providerId: string
  try {
    providerId = decodeURIComponent(providerMatch[1])
  } catch {
    return undefined
  }
  if (providerId.length === 0 || providerId.length > 200) return undefined
  const subroute = v.safeParse(v.optional(externalIdentityLoginSubrouteSchema), providerMatch[2])
  if (!subroute.success) return undefined
  return {
    ...(subroute.output === undefined ? {} : { providerSubroute: subroute.output }),
    ...(subroute.output === "failure" ? { state: "error" as const } : {}),
    providerId,
    screen: "provider",
  }
}
