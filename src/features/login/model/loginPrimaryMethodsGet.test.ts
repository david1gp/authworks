import { describe, expect, test } from "bun:test"
import { loginPrimaryMethodsGet } from "./loginPrimaryMethodsGet.js"

describe("loginPrimaryMethodsGet", () => {
  test("derives enabled methods and requires providers for external identity", () => {
    const policy = {
      allowDomainDiscovery: true,
      allowEmailOtp: true,
      allowWhatsappOtp: true,
      allowExternalIdentity: true,
      allowPassword: true,
      allowPasswordRecovery: true,
      allowPasskey: true,
      allowRegistration: true,
      providerIds: null,
    }
    expect(loginPrimaryMethodsGet(policy, 0, false)).toEqual(["email-otp", "password", "passkey"])
    expect(loginPrimaryMethodsGet(policy, 0, true)).toEqual(["email-otp", "whatsapp-otp", "password", "passkey"])
    expect(loginPrimaryMethodsGet(policy, 1, true)).toEqual([
      "email-otp",
      "whatsapp-otp",
      "password",
      "passkey",
      "external-identity",
    ])
  })

  test("does not expose WhatsApp without an explicit policy flag", () => {
    const policy = {
      allowDomainDiscovery: true,
      allowEmailOtp: true,
      allowExternalIdentity: false,
      allowPassword: true,
      allowPasswordRecovery: true,
      allowPasskey: true,
      allowRegistration: true,
      providerIds: null,
    }
    expect(loginPrimaryMethodsGet(policy, 0, true)).not.toContain("whatsapp-otp")
  })
})
