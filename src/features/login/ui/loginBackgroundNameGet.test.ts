import { describe, expect, test } from "bun:test"
import { loginBackgroundNameGet } from "./loginBackgroundNameGet.js"

describe("loginBackgroundNameGet", () => {
  test.each([
    ["chooser", "chooser"],
    ["recent-accounts", "directory"],
    ["password", "password"],
    ["password-change-required", "password-change"],
    ["email-otp", "email-otp"],
    ["passkey", "passkey"],
    ["provider", "provider"],
    ["mfa-totp", "mfa"],
    ["recovery-reset", "recovery"],
    ["loading", "loading"],
    ["unsupported", "fatal"],
  ] as const)("maps %s to %s", (screen, expected) => {
    expect(loginBackgroundNameGet(screen)).toBe(expected)
  })
})
