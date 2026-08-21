import { describe, expect, test } from "bun:test"
import { organizationAdminApiCreate } from "../../src/features/organizations/ui/organizationAdminApiCreate.js"
import { organizationAdminFailureStatusSelect } from "../../src/features/organizations/ui/organizationAdminFailureStatusSelect.js"

const realmId = "018f0000-0000-7000-8000-000000000001"
const organizationId = "018f0000-0000-7000-8000-000000000002"

const organizationJson = {
  createdAt: 1,
  id: organizationId,
  name: "Northwind Labs",
  realmId,
  status: "active",
  updatedAt: 1,
}

describe("organization administration browser API", () => {
  test("exchanges a session CSRF token before every organization mutation", async () => {
    const requests: { init?: RequestInit; method?: string; url: string }[] = []
    const api = organizationAdminApiCreate({
      baseUrl: "https://auth.example",
      fetch: async (input, init) => {
        const url = String(input)
        requests.push({ init, method: init?.method, url })
        if (url.endsWith("/sessions/csrf")) return Response.json({ csrfToken: "csrf-fixture" })
        return Response.json({ organization: organizationJson })
      },
      realmId: () => realmId,
    })

    const result = await api.organizationCreate({ name: "Northwind Labs" })

    expect(result.success).toBe(true)
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      `/realms/${realmId}/sessions/csrf`,
      `/realms/${realmId}/organizations`,
    ])
    expect(new Headers(requests[1]?.init?.headers).get("x-csrf-token")).toBe("csrf-fixture")
    expect(requests[1]?.init?.credentials).toBe("include")
  })

  test("does not send the mutation when the CSRF exchange fails", async () => {
    let requestCount = 0
    const api = organizationAdminApiCreate({
      baseUrl: "https://auth.example",
      fetch: async () => {
        requestCount += 1
        return Response.json(
          { error: { code: "sessions.unauthorized", message: "Session expired.", op: "csrf", status: 401 } },
          { status: 401 },
        )
      },
      realmId: () => realmId,
    })

    const result = await api.membershipRemove(organizationId, "membership-1")

    expect(result.success).toBe(false)
    expect(requestCount).toBe(1)
  })

  test("reads collections without a CSRF exchange and keeps cookies", async () => {
    const requests: { init?: RequestInit; url: string }[] = []
    const api = organizationAdminApiCreate({
      baseUrl: "https://auth.example",
      fetch: async (input, init) => {
        requests.push({ init, url: String(input) })
        return Response.json({ items: [organizationJson] })
      },
      realmId: () => realmId,
    })

    const result = await api.organizationList()

    expect(result.success).toBe(true)
    expect(requests).toHaveLength(1)
    expect(new URL(requests[0]!.url).pathname).toBe(`/realms/${realmId}/organizations`)
    expect(requests[0]?.init?.credentials).toBe("include")
  })

  test("routes realm-wide login policy when no organization is selected", async () => {
    const paths: string[] = []
    const api = organizationAdminApiCreate({
      baseUrl: "https://auth.example",
      fetch: async (input) => {
        paths.push(new URL(String(input)).pathname)
        return Response.json({
          organizationId: null,
          overrides: {},
          policy: {
            allowDomainDiscovery: true,
            allowEmailOtp: true,
            allowExternalIdentity: true,
            allowPasskey: true,
            allowPassword: true,
            allowPasswordRecovery: true,
            allowRegistration: true,
            providerIds: null,
          },
          realmId,
        })
      },
      realmId: () => realmId,
    })

    await api.loginPolicyGet("")
    await api.loginPolicyGet(organizationId)

    expect(paths).toEqual([
      `/realms/${realmId}/login-policy`,
      `/realms/${realmId}/organizations/${organizationId}/login-policy`,
    ])
  })
})

describe("organization administration failure mapping", () => {
  test("separates permission, assurance, and generic failures", () => {
    expect(organizationAdminFailureStatusSelect({ statusCode: 403 })).toBe("permission-denied")
    expect(organizationAdminFailureStatusSelect({ statusCode: 401 })).toBe("permission-denied")
    expect(organizationAdminFailureStatusSelect({ code: "sessions.assurance-required" })).toBe("assurance-required")
    expect(organizationAdminFailureStatusSelect({ code: "organizations.invalid", statusCode: 400 })).toBe("error")
    expect(organizationAdminFailureStatusSelect({})).toBe("error")
  })
})
