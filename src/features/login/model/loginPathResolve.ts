import * as v from "valibot"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { type LoginScreen, loginScreenSchema } from "./loginScreenSchema.js"

type LoginPathResolution = {
  readonly screen: LoginScreen
  readonly state?: DemoFixtureState
}

/**
 * Maps a hosted login sub-path onto its screen. Legacy `/demo/login` paths that encoded an outcome
 * additionally resolve the fixture state they were named after.
 */
const loginPathTable: Readonly<Record<string, LoginPathResolution>> = {
  "": { screen: "chooser" },
  "/chooser": { screen: "chooser" },
  "/chooser/recent-accounts": { screen: "recent-accounts" },
  "/email-otp": { screen: "email-otp" },
  "/email-otp/code": { screen: "email-otp-code" },
  "/idp": { screen: "provider" },
  "/idp/failure": { screen: "provider", state: "error" },
  "/loading": { screen: "loading" },
  "/logout": { screen: "logout" },
  "/logout/done": { screen: "logout-done" },
  "/mfa": { screen: "mfa" },
  "/mfa/email-otp": { screen: "mfa-email-otp" },
  "/mfa/passkey": { screen: "mfa-passkey" },
  "/mfa/recovery-code": { screen: "mfa-recovery-code" },
  "/mfa/totp": { screen: "mfa-totp" },
  "/mfa/totp-enroll": { screen: "mfa-totp-enroll" },
  "/passkey": { screen: "passkey" },
  "/passkey/unsupported": { screen: "passkey", state: "permission-denied" },
  "/password": { screen: "password" },
  "/password/change-required": { screen: "password-change-required" },
  "/password/error": { screen: "password", state: "error" },
  "/password/forgot": { screen: "recovery-request" },
  "/password/forgot/sent": { screen: "recovery-sent" },
  "/password/reset": { screen: "recovery-reset" },
  "/password/reset/complete": { screen: "recovery-complete" },
  "/register": { screen: "register" },
  "/register/done": { screen: "register-done" },
  "/signed-in": { screen: "signed-in" },
  "/unsupported": { screen: "unsupported" },
  "/verify-email": { screen: "verify-email" },
}

export function loginPathResolve(pathname: string, basePath: string): LoginPathResolution | undefined {
  if (!pathname.startsWith(basePath)) return undefined
  const suffix = pathname.slice(basePath.length).replace(/\/+$/, "")
  const resolved = loginPathTable[suffix]
  if (resolved === undefined) return undefined
  if (!v.safeParse(loginScreenSchema, resolved.screen).success) return undefined
  return resolved
}
