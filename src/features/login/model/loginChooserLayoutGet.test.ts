import { describe, expect, test } from "bun:test"
import { loginChooserLayoutGet } from "./loginChooserLayoutGet.js"

describe("loginChooserLayoutGet", () => {
  test("splits only when own-account methods and external providers are both offered", () => {
    expect(loginChooserLayoutGet(["email-otp", "password", "passkey", "external-identity"])).toBe("split")
    expect(loginChooserLayoutGet(["password", "external-identity"])).toBe("split")
  })

  test("stays single when either group is empty", () => {
    expect(loginChooserLayoutGet(["email-otp", "password", "passkey"])).toBe("single")
    expect(loginChooserLayoutGet(["external-identity"])).toBe("single")
    expect(loginChooserLayoutGet([])).toBe("single")
  })
})
