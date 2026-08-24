import { describe, expect, test } from "bun:test"
import { emailOtpEmailMask } from "./emailOtpEmailMask.js"

describe("emailOtpEmailMask", () => {
  test("shows a safe partial destination", () => {
    expect(emailOtpEmailMask("alex@acme.example")).toBe("al**@acme.example")
  })

  test("does not echo an invalid destination", () => {
    expect(emailOtpEmailMask("not-an-email")).toBe("your email address")
  })
})
