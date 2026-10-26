import { describe, expect, test } from "bun:test"
import { loginServerErrorKeyGet } from "./loginServerErrorKeyGet.js"

describe("loginServerErrorKeyGet", () => {
  test("maps stable login failures to catalog keys", () => {
    expect(loginServerErrorKeyGet("passwords.unauthorized")).toBe("login.error.credentialsInvalid")
    expect(loginServerErrorKeyGet("passwords.policy-rejected")).toBe("login.recovery.policyRejected")
    expect(loginServerErrorKeyGet("email-otp.unauthorized")).toBe("login.error.codeInvalid")
    expect(loginServerErrorKeyGet("email-otp.rate-limited")).toBe("login.error.rateLimited")
    expect(loginServerErrorKeyGet("passwords.rate-limited")).toBe("login.error.rateLimited")
    expect(loginServerErrorKeyGet("whatsapp-otp.rate-limited")).toBe("login.error.rateLimited")
    expect(loginServerErrorKeyGet("mfa.unauthorized")).toBe("login.error.codeInvalid")
    expect(loginServerErrorKeyGet("mfa.factor-disabled")).toBe("login.mfa.factorUnavailable")
    expect(loginServerErrorKeyGet("mfa.factor-unavailable")).toBe("login.mfa.factorUnavailable")
  })

  test("leaves ambiguous or flow-specific codes unmapped so the server message survives", () => {
    expect(loginServerErrorKeyGet("passwords.invalid")).toBeUndefined()
    expect(loginServerErrorKeyGet("email-otp.invalid")).toBeUndefined()
    expect(loginServerErrorKeyGet("whatsapp-otp.invalid")).toBeUndefined()
    expect(loginServerErrorKeyGet("sessions.invalid")).toBeUndefined()
    expect(loginServerErrorKeyGet("platform.internal")).toBeUndefined()
    expect(loginServerErrorKeyGet(undefined)).toBeUndefined()
  })
})
