import { describe, expect, test } from "bun:test"
import { mfaCodeNormalize } from "./mfaCodeNormalize.js"

describe("mfaCodeNormalize", () => {
  test("keeps OTP input numeric and bounded", () => {
    expect(mfaCodeNormalize("totp", "12a3 456789")).toBe("123456")
    expect(mfaCodeNormalize("email_otp", "01-2345")).toBe("012345")
  })

  test("normalizes recovery-code separators without changing the contract", () => {
    expect(mfaCodeNormalize("recovery_code", " abcd-1234 ")).toBe("ABCD-1234")
    expect(mfaCodeNormalize("recovery_code", "a".repeat(70))).toHaveLength(64)
  })
})
