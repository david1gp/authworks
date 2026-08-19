import { describe, expect, test } from "bun:test"
import { loginPrimaryMethodsGet } from "./loginPrimaryMethodsGet.js"

describe("loginPrimaryMethodsGet", () => {
  test("derives enabled methods and requires providers for external identity", () => {
    const policy = {
      allowDomainDiscovery: true,
      allowEmailOtp: true,
      allowExternalIdentity: true,
      allowPassword: true,
      allowPasswordRecovery: true,
      allowPasskey: true,
      allowRegistration: true,
      providerIds: null,
    }
    expect(loginPrimaryMethodsGet(policy, 0)).toEqual(["password", "email-otp", "passkey"])
    expect(loginPrimaryMethodsGet(policy, 1)).toEqual(["password", "email-otp", "passkey", "external-identity"])
  })
})
