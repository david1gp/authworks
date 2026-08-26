import { afterEach, describe, expect, test } from "bun:test"
import { passkeyAuthenticationRun } from "../../src/features/passkeys/ui/passkeyAuthenticationRun.js"
import { englishCatalog } from "../../src/ui/i18n/model/englishCatalog.js"

const originalNavigator = globalThis.navigator
const originalPublicKeyCredential = globalThis.PublicKeyCredential

const start = {
  options: {
    challenge: "YQ",
    timeout: 60_000,
    userVerification: "required" as const,
  },
  token: "t".repeat(43),
}

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: originalNavigator })
  Object.defineProperty(globalThis, "PublicKeyCredential", {
    configurable: true,
    value: originalPublicKeyCredential,
  })
})

describe("passkeyAuthenticationRun", () => {
  test("reports unsupported browser capability before opening a ceremony", async () => {
    Object.defineProperty(globalThis, "PublicKeyCredential", { configurable: true, value: undefined })
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: { credentials: undefined } })
    const statuses: string[] = []

    const result = await passkeyAuthenticationRun(start, { statusSet: (status) => statuses.push(status) })

    expect(result.success).toBe(false)
    expect(statuses).toEqual(["unsupported"])
  })

  test("classifies user cancellation as a retryable ceremony failure", async () => {
    Object.defineProperty(globalThis, "PublicKeyCredential", { configurable: true, value: class {} })
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { credentials: { get: async () => Promise.reject({ name: "NotAllowedError" }) } },
    })
    const statuses: string[] = []

    const result = await passkeyAuthenticationRun(start, { statusSet: (status) => statuses.push(status) })

    expect(result).toMatchObject({ success: false, errorMessage: englishCatalog["login.passkey.canceled"] })
    expect(statuses).toEqual(["pending", "ceremony-failure"])
  })

  test("classifies an aborted or timed-out ceremony as a retryable ceremony failure", async () => {
    Object.defineProperty(globalThis, "PublicKeyCredential", { configurable: true, value: class {} })
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { credentials: { get: async () => Promise.reject({ name: "AbortError" }) } },
    })
    const statuses: string[] = []

    const result = await passkeyAuthenticationRun(start, { statusSet: (status) => statuses.push(status) })

    expect(result).toMatchObject({ success: false, errorMessage: englishCatalog["login.passkey.canceled"] })
    expect(statuses).toEqual(["pending", "ceremony-failure"])
  })

  test("classifies an empty browser credential as a canceled ceremony", async () => {
    Object.defineProperty(globalThis, "PublicKeyCredential", { configurable: true, value: class {} })
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { credentials: { get: async () => null } },
    })
    const statuses: string[] = []

    const result = await passkeyAuthenticationRun(start, { statusSet: (status) => statuses.push(status) })

    expect(result).toMatchObject({ success: false, errorMessage: englishCatalog["login.passkey.canceled"] })
    expect(statuses).toEqual(["pending", "ceremony-failure"])
  })

  test("classifies browser ceremony failures without exposing native errors", async () => {
    Object.defineProperty(globalThis, "PublicKeyCredential", { configurable: true, value: class {} })
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { credentials: { get: async () => Promise.reject({ name: "SecurityError", message: "secret" }) } },
    })
    const statuses: string[] = []

    const result = await passkeyAuthenticationRun(start, { statusSet: (status) => statuses.push(status) })

    expect(result).toMatchObject({
      success: false,
      errorMessage: englishCatalog["login.passkey.ceremonyFailure"],
    })
    expect(JSON.stringify(result)).not.toContain("secret")
    expect(statuses).toEqual(["pending", "ceremony-failure"])
  })

  test("serializes a successful assertion using the Authworks completion contract", async () => {
    Object.defineProperty(globalThis, "PublicKeyCredential", { configurable: true, value: class {} })
    const credential = {
      authenticatorAttachment: "platform",
      getClientExtensionResults: () => ({ credProps: { rk: true } }),
      id: "credential-1",
      rawId: Uint8Array.from([1, 2]),
      response: {
        authenticatorData: Uint8Array.from([3]),
        clientDataJSON: Uint8Array.from([4]),
        signature: Uint8Array.from([5]),
        userHandle: Uint8Array.from([6]),
      },
      type: "public-key",
    }
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { credentials: { get: async () => credential } },
    })
    const statuses: string[] = []

    const result = await passkeyAuthenticationRun(start, { statusSet: (status) => statuses.push(status) })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toMatchObject({
        response: {
          id: "credential-1",
          rawId: "AQI",
          response: { authenticatorData: "Aw", clientDataJSON: "BA", signature: "BQ", userHandle: "Bg" },
          type: "public-key",
        },
        token: "t".repeat(43),
      })
    }
    expect(statuses).toEqual(["pending", "ready"])
  })
})
