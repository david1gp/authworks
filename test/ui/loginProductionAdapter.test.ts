import { describe, expect, test } from "bun:test"
import { demoLoginBootstrap } from "../../src/features/demo/demoLoginBootstrap.js"
import type { LoginDiscovery } from "../../src/features/login/ui/loginAdapter.js"
import type { loginApiCreate } from "../../src/features/login/ui/loginApiCreate.js"
import { loginProductionAdapterCreate } from "../../src/features/login/ui/loginProductionAdapterCreate.js"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../src/platform/errors/resultErrorCodedCreate.js"

describe("production login adapter", () => {
  test("does not invent optional MFA transports and fails safely before discovery", async () => {
    const calls: string[] = []
    const adapter = loginProductionAdapterCreate({
      api: apiCreate(calls),
      discovery: () => undefined,
      discoverySet: () => undefined,
      domain: "acme.example",
      interactionHandle: () => undefined,
      interactionResume: () => undefined,
    })

    const result = await adapter.passwordLogin("alex@acme.example", "secret")

    expect(result.success).toBe(false)
    if (!result.success) expect(result.code).toBe("organizations.not-found")
    expect(adapter.mfaEmailOtpStart).toBeUndefined()
    expect(adapter.mfaEmailOtpEnroll).toBeUndefined()
    expect(adapter.mfaEmailOtpResend).toBeUndefined()
    expect(adapter.mfaEmailOtpVerify).toBeUndefined()
    expect(adapter.mfaPasskeyAuthenticate).toBeUndefined()
    expect(adapter.whatsappOtpAvailable?.()).toBe(false)
    expect(calls).toEqual([])
  })

  test("binds discovered realm and organization identifiers to existing API operations", async () => {
    const calls: string[] = []
    let discovered: LoginDiscovery | undefined
    const adapter = loginProductionAdapterCreate({
      api: apiCreate(calls),
      discovery: () => discovered,
      discoverySet: (value) => {
        discovered = value
      },
      domain: "acme.example",
      interactionHandle: () => "interaction-1",
      interactionResume: () => undefined,
    })

    const found = await adapter.discover()
    expect(found.success).toBe(true)
    expect(discovered?.organization.realmId).toBe("realm-acme")

    const authenticated = await adapter.passwordLogin("alex@acme.example", "secret")
    expect(authenticated).toEqual({ data: { userId: "demo-user" }, success: true })
    expect(calls).toContain("passwordLogin:realm-acme:alex@acme.example:secret:org-acme")
  })

  test("binds WhatsApp availability and OTP operations to discovered realm and organization", async () => {
    const calls: string[] = []
    const adapter = loginProductionAdapterCreate({
      api: apiCreate(calls),
      discovery: () => demoLoginBootstrap,
      discoverySet: () => undefined,
      domain: "acme.example",
      interactionHandle: () => undefined,
      interactionResume: () => undefined,
    })

    await adapter.discover()
    const started = await adapter.whatsappOtpStart?.("+15551234567")
    const resent = await adapter.whatsappOtpResend?.("wa-challenge")
    const verified = await adapter.whatsappOtpVerify?.("wa-challenge", "123456")

    expect(adapter.whatsappOtpAvailable?.()).toBe(true)
    expect(started?.success).toBe(true)
    expect(resent?.success).toBe(true)
    expect(verified).toEqual({
      data: {
        challenge: {
          challenge: { expiresAt: 20, id: "mfa-challenge", purpose: "login", requiredAssurance: "multi_factor" },
          token: "t".repeat(43),
        },
        userId: "demo-user",
      },
      success: true,
    })
    expect(calls).toContain("whatsappAvailability:realm-acme:org-acme")
    expect(calls).toContain("whatsappStart:realm-acme:+15551234567:org-acme")
    expect(calls).toContain("whatsappResend:realm-acme:wa-challenge:org-acme")
    expect(calls).toContain("whatsappVerify:realm-acme:wa-challenge:123456:org-acme")
  })

  test("refreshes cached WhatsApp availability across later outages and recovery", async () => {
    const api = apiCreate([])
    const availability = [
      resultCreate({ available: true }),
      resultErrorCodedCreate("whatsappAvailability", "unavailable", "whatsapp-otp.invalid"),
      resultCreate({ available: true }),
    ]
    api.whatsappOtpAvailabilityGet = async () => availability.shift() ?? resultCreate({ available: false })
    const adapter = loginProductionAdapterCreate({
      api,
      discovery: () => demoLoginBootstrap,
      discoverySet: () => undefined,
      domain: "acme.example",
      interactionHandle: () => undefined,
      interactionResume: () => undefined,
    })

    await adapter.discover()
    expect(adapter.whatsappOtpAvailable?.()).toBe(true)
    await adapter.discover()
    expect(adapter.whatsappOtpAvailable?.()).toBe(false)
    await adapter.discover()
    expect(adapter.whatsappOtpAvailable?.()).toBe(true)
  })

  test("passes a browser WhatsApp authentication outcome through without a bearer response", async () => {
    const adapter = loginProductionAdapterCreate({
      api: apiCreate([], [], false),
      discovery: () => demoLoginBootstrap,
      discoverySet: () => undefined,
      domain: "acme.example",
      interactionHandle: () => undefined,
      interactionResume: () => undefined,
    })

    await adapter.discover()
    const verified = await adapter.whatsappOtpVerify?.("wa-challenge", "123456")

    expect(verified).toEqual({ data: { userId: "demo-user" }, success: true })
  })

  test("turns recent-session failures into an empty remembered-account list", async () => {
    const adapter = loginProductionAdapterCreate({
      api: apiCreate([]),
      discovery: () => demoLoginBootstrap,
      discoverySet: () => undefined,
      domain: "acme.example",
      interactionHandle: () => undefined,
      interactionResume: () => undefined,
    })

    const accounts = await adapter.recentAccounts()

    expect(accounts).toEqual({ data: [], success: true })
  })

  test("maps recent-session labels and login identifiers", async () => {
    const adapter = loginProductionAdapterCreate({
      api: apiCreate(
        [],
        [
          {
            authenticationMethod: "password",
            id: "session-alex",
            label: "Alex Morgan",
            lastUsedAt: 10,
            loginIdentifier: "alex-login",
            userId: "alex@acme.example",
          },
        ],
      ),
      discovery: () => demoLoginBootstrap,
      discoverySet: () => undefined,
      domain: "acme.example",
      interactionHandle: () => undefined,
      interactionResume: () => undefined,
    })

    const accounts = await adapter.recentAccounts()

    expect(accounts).toEqual({
      data: [
        {
          authenticationMethod: "password",
          identifier: "alex-login",
          label: "Alex Morgan",
          lastUsedAt: 10,
          sessionId: "session-alex",
        },
      ],
      success: true,
    })
  })

  test("resumes a recent session in the discovered organization context", async () => {
    const calls: string[] = []
    const adapter = loginProductionAdapterCreate({
      api: apiCreate(calls),
      discovery: () => demoLoginBootstrap,
      discoverySet: () => undefined,
      domain: "acme.example",
      interactionHandle: () => undefined,
      interactionResume: () => undefined,
    })

    const resumed = await adapter.recentAccountResume("session-alex")

    expect(resumed).toEqual({ data: { resumed: true }, success: true })
    expect(calls).toContain("recentResume:realm-acme:session-alex:org-acme")
  })

  test("skips malformed recent sessions and shows one account per login identifier", async () => {
    const adapter = loginProductionAdapterCreate({
      api: apiCreate(
        [],
        [
          {
            authenticationMethod: "password",
            id: "session-alex-new",
            label: "Alex Morgan",
            lastUsedAt: 20,
            loginIdentifier: "alex-login",
            userId: "alex@acme.example",
          },
          {
            authenticationMethod: "password",
            id: "session-alex-old",
            label: "Alex Morgan",
            lastUsedAt: 10,
            loginIdentifier: "alex-login",
            userId: "alex@acme.example",
          },
          {
            authenticationMethod: "password",
            id: "session-malformed",
            label: "Malformed Session",
            lastUsedAt: 30,
            userId: "different-user",
          },
        ],
      ),
      discovery: () => demoLoginBootstrap,
      discoverySet: () => undefined,
      domain: "acme.example",
      interactionHandle: () => undefined,
      interactionResume: () => undefined,
    })

    const accounts = await adapter.recentAccounts()

    expect(accounts).toEqual({
      data: [
        {
          authenticationMethod: "password",
          identifier: "alex-login",
          label: "Alex Morgan",
          lastUsedAt: 20,
          sessionId: "session-alex-new",
        },
      ],
      success: true,
    })
  })
})

function apiCreate(
  calls: string[],
  recentItems: readonly unknown[] = [],
  whatsappChallenge = true,
): ReturnType<typeof loginApiCreate> {
  return {
    discover: async (domain: string) => {
      calls.push(`discover:${domain}`)
      return resultCreate(demoLoginBootstrap)
    },
    passwordLogin: async (realmId: string, identifier: string, password: string, organizationId?: string) => {
      calls.push(`passwordLogin:${realmId}:${identifier}:${password}:${organizationId}`)
      return resultCreate({
        authentication: { userId: "demo-user" },
      })
    },
    whatsappOtpAvailabilityGet: async (realmId: string, organizationId?: string) => {
      calls.push(`whatsappAvailability:${realmId}:${organizationId}`)
      return resultCreate({ available: true })
    },
    whatsappOtpResend: async (realmId: string, challengeId: string, organizationId?: string) => {
      calls.push(`whatsappResend:${realmId}:${challengeId}:${organizationId}`)
      return resultCreate({ accepted: true as const, challengeId, expiresAt: 20, retryAt: 15 })
    },
    whatsappOtpStart: async (realmId: string, phoneNumber: string, organizationId?: string) => {
      calls.push(`whatsappStart:${realmId}:${phoneNumber}:${organizationId}`)
      return resultCreate({ accepted: true as const, challengeId: "wa-challenge", expiresAt: 20, retryAt: 15 })
    },
    whatsappOtpVerify: async (realmId: string, challengeId: string, code: string, organizationId?: string) => {
      calls.push(`whatsappVerify:${realmId}:${challengeId}:${code}:${organizationId}`)
      return resultCreate({
        authentication: { userId: "demo-user" },
        ...(whatsappChallenge
          ? {
              challenge: {
                challenge: {
                  expiresAt: 20,
                  id: "mfa-challenge",
                  purpose: "login",
                  requiredAssurance: "multi_factor",
                },
                token: "t".repeat(43),
              },
            }
          : {}),
      })
    },
    recentList: async (_realmId: string) =>
      recentItems.length === 0
        ? resultErrorCodedCreate("recentList", "recent sessions unavailable", "sessions.invalid")
        : resultCreate({ items: recentItems }),
    recentResume: async (realmId: string, sessionId: string, organizationId?: string) => {
      calls.push(`recentResume:${realmId}:${sessionId}:${organizationId}`)
      return resultCreate({ session: {} })
    },
  } as unknown as ReturnType<typeof loginApiCreate>
}
