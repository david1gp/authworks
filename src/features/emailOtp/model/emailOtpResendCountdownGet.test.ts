import { describe, expect, test } from "bun:test"
import { emailOtpResendCountdownGet } from "./emailOtpResendCountdownGet.js"

describe("emailOtpResendCountdownGet", () => {
  test("rounds a server retry time up to whole seconds", () => {
    expect(emailOtpResendCountdownGet(10_001, 1_000)).toBe(10)
    expect(emailOtpResendCountdownGet(9_999, 1_000)).toBe(9)
  })

  test("never returns a negative countdown", () => {
    expect(emailOtpResendCountdownGet(1_000, 1_001)).toBe(0)
  })
})
