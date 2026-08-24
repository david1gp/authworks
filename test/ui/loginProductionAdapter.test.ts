import { describe, expect, test } from "bun:test"
import { resultCreate } from "../../src/platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../src/platform/errors/resultErrorCodedCreate.js"
import { demoLoginBootstrap } from "../../src/features/demo/demoLoginBootstrap.js"
import type { LoginDiscovery } from "../../src/features/login/ui/loginAdapter.js"
import type { loginApiCreate } from "../../src/features/login/ui/loginApiCreate.js"
import { loginProductionAdapterCreate } from "../../src/features/login/ui/loginProductionAdapterCreate.js"

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
})

function apiCreate(calls: string[]): ReturnType<typeof loginApiCreate> {
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
    recentList: async (_realmId: string) =>
      resultErrorCodedCreate("recentList", "recent sessions unavailable", "sessions.invalid"),
  } as unknown as ReturnType<typeof loginApiCreate>
}
