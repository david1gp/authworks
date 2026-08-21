import { describe, expect, test } from "bun:test"
import { accountAccessApiCreate } from "../../src/features/account/ui/accountAccessApiCreate.js"

describe("account access browser API", () => {
  test("uses the session CSRF exchange for organization switching", async () => {
    const realmId = "018f0000-0000-7000-8000-000000000001"
    const organizationId = "018f0000-0000-7000-8000-000000000002"
    const requests: { init?: RequestInit; url: string }[] = []
    const fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      requests.push({ init, url })
      if (url.endsWith("/sessions/csrf")) {
        return Response.json({ csrfToken: "csrf-fixture" })
      }
      return Response.json({
        activeOrganizationId: organizationId,
        context: {
          actor: {
            actorId: "user-1",
            assurance: "authenticated",
            authenticationMethod: "trusted",
            kind: "user",
            organizationId,
            realmId,
          },
          actorId: "user-1",
          kind: "organization",
          organizationId,
          realmId,
        },
        organization: {
          createdAt: 1,
          id: organizationId,
          name: "Field Notes",
          realmId,
          status: "active",
          updatedAt: 1,
        },
      })
    }
    const api = accountAccessApiCreate({ baseUrl: "https://auth.example", fetch })

    const result = await api.organizationSwitch(realmId, organizationId)

    expect(result.success).toBe(true)
    expect(requests.map((request) => request.url)).toEqual([
      `https://auth.example/realms/${realmId}/sessions/csrf`,
      `https://auth.example/realms/${realmId}/me/organizations/switch`,
    ])
    expect(new Headers(requests[1]?.init?.headers).get("x-csrf-token")).toBe("csrf-fixture")
    expect(requests[1]?.init?.credentials).toBe("include")
  })

  test("does not send a mutation when the CSRF exchange fails", async () => {
    let requestCount = 0
    const api = accountAccessApiCreate({
      baseUrl: "https://auth.example",
      fetch: async () => {
        requestCount += 1
        return Response.json(
          { error: { code: "sessions.unauthorized", message: "Session expired.", op: "csrf", status: 401 } },
          { status: 401 },
        )
      },
    })

    const result = await api.consentRevoke("realm-1", "client-1")

    expect(result.success).toBe(false)
    expect(requestCount).toBe(1)
  })
})
