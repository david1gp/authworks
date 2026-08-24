import { describe, expect, test } from "bun:test"
import { emailOtpCodeNormalize } from "./emailOtpCodeNormalize.js"

describe("emailOtpCodeNormalize", () => {
  test("keeps only the six numeric code digits", () => {
    expect(emailOtpCodeNormalize("12a3-456789")).toBe("123456")
  })
})
