import { afterEach, describe, expect, test } from "bun:test"
import { productionApplicationContextsCreate } from "../../src/ui/production/productionApplicationContextsCreate.js"

const realmId = "018f0000-0000-7000-8000-000000000001"
const organizationId = "123456789012345678"
const userId = "98765432109876543210"
const previousFetch = globalThis.fetch
const previousWindow = globalThis.window

afterEach(() => {
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: previousFetch })
  Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow })
})

describe("production application contexts", () => {
  test("consumes the account organization response with migrated string IDs", async () => {
    const responses: Record<string, unknown> = {
      "/organization-discovery": {
        branding: {
          dark: { backgroundColor: "#111827", fontColor: "#f9fafb", primaryColor: "#60a5fa", warnColor: "#f87171" },
          disableWatermark: true,
          light: { backgroundColor: "#f8fafc", fontColor: "#111827", primaryColor: "#2563eb", warnColor: "#dc2626" },
          themeMode: "system",
        },
        domain: "customer.example",
        found: true,
        organization: { id: organizationId, name: "Owner organization", realmId },
        policy: {
          allowDomainDiscovery: true,
          allowEmailOtp: true,
          allowExternalIdentity: true,
          allowExternalIdentityAutoLinking: true,
          allowPassword: true,
          allowPasswordRecovery: true,
          allowPasskey: true,
          allowRegistration: true,
          providerIds: [],
          requiredMfa: false,
          allowedFactors: ["totp", "email_otp", "passkey"],
          preferredFactorOrder: ["totp", "email_otp", "passkey"],
          minimumStepUpAssurance: "authenticated",
        },
        providers: [],
      },
      [`/realms/${realmId}/me`]: {
        capabilities: { realmRead: false },
        user: {
          createdAt: 1,
          email: "alice@example.com",
          emailVerified: true,
          id: userId,
          profile: { displayName: "Alice Example" },
          realmId,
          state: "active",
          updatedAt: 1,
          userName: "alice",
          verificationState: "verified",
        },
      },
      [`/realms/${realmId}/me/organizations`]: {
        items: [
          {
            membership: {
              createdAt: 1,
              id: "membership-1",
              organizationId,
              realmId,
              roles: ["member"],
              updatedAt: 1,
              userId,
            },
            organization: {
              createdAt: 1,
              id: organizationId,
              name: "Owner organization",
              realmId,
              status: "active",
              updatedAt: 1,
            },
          },
        ],
      },
      [`/realms/${realmId}/sessions/current`]: {
        session: {
          assurance: "authenticated",
          authenticationMethod: "password",
          createdAt: 1,
          current: true,
          device: {},
          expiresAt: 2,
          id: "session-1",
          lastUsedAt: 1,
          realmId,
          revokedAt: null,
          subjectId: userId,
          subjectType: "user",
          userId,
        },
      },
      [`/realms/${realmId}`]: {
        realm: {
          createdAt: 1,
          domain: "customer.example",
          domains: ["customer.example"],
          id: realmId,
          name: "customer",
          status: "active",
          updatedAt: 1,
        },
      },
    }
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: async (input: string | URL | Request) => {
        const path = new URL(String(input), "https://auth.example").pathname
        const body = responses[path]
        return body === undefined ? Response.json({}, { status: 404 }) : Response.json(body)
      },
    })
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { href: "https://auth.example/account/organizations" } },
    })

    const contexts = await productionApplicationContextsCreate()

    expect(contexts.session.organizations).toEqual([{ id: organizationId, label: "Owner organization" }])
    expect(contexts.session.guard.organization).toEqual({ organizationId, status: "available" })
    expect(contexts.session.guard.authentication).toEqual({ status: "authenticated", userId })
    expect(contexts.session.guard.permission).toBe("denied")
  })
})
