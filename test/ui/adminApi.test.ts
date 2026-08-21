import { describe, expect, test } from "bun:test"
import { adminApiCreate } from "../../src/features/admin/ui/adminApiCreate.js"

const realmId = "018f0000-0000-7000-8000-000000000001"

const realmBody = {
  realm: {
    createdAt: 1,
    domain: "auth.example",
    domains: ["auth.example"],
    id: "018f0000-0000-7000-8000-000000000009",
    name: "Example",
    status: "active",
    updatedAt: 2,
  },
}

describe("admin browser API", () => {
  test("submits the bootstrap credential once without a CSRF exchange and without storing it", async () => {
    const requests: { body?: unknown; init?: RequestInit; url: string }[] = []
    const api = adminApiCreate({
      baseUrl: "https://auth.example",
      fetch: async (input, init) => {
        requests.push({ body: init?.body, init, url: String(input) })
        return Response.json({
          adminId: "admin-1",
          expiresAt: 10,
          realmId,
          sessionId: "session-1",
        })
      },
    })

    const result = await api.adminSignIn(realmId, "a".repeat(48))

    expect(result.success).toBe(true)
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe(`https://auth.example/realms/${realmId}/admin/sign-in`)
    expect(requests[0]?.init?.credentials).toBe("include")
    expect(requests[0]?.body).toBe(JSON.stringify({ secret: "a".repeat(48) }))
  })

  test("uses the session CSRF exchange for realm updates", async () => {
    const requests: { init?: RequestInit; url: string }[] = []
    const api = adminApiCreate({
      baseUrl: "https://auth.example",
      fetch: async (input, init) => {
        const url = String(input)
        requests.push({ init, url })
        if (url.endsWith("/sessions/csrf")) return Response.json({ csrfToken: "csrf-fixture" })
        return Response.json(realmBody)
      },
    })

    const result = await api.realmUpdate(realmId, { name: "Renamed" })

    expect(result.success).toBe(true)
    expect(requests.map((request) => request.url)).toEqual([
      `https://auth.example/realms/${realmId}/sessions/csrf`,
      `https://auth.example/realms/${realmId}`,
    ])
    expect(requests[1]?.init?.method).toBe("PATCH")
    expect(new Headers(requests[1]?.init?.headers).get("x-csrf-token")).toBe("csrf-fixture")
    expect(requests[1]?.init?.credentials).toBe("include")
  })

  test("does not send a realm mutation when the CSRF exchange fails", async () => {
    let requestCount = 0
    const api = adminApiCreate({
      baseUrl: "https://auth.example",
      fetch: async () => {
        requestCount += 1
        return Response.json(
          { error: { code: "sessions.unauthorized", message: "Session expired.", op: "csrf", status: 401 } },
          { status: 401 },
        )
      },
    })

    const result = await api.realmUpdate(realmId, { status: "disabled" })

    expect(result.success).toBe(false)
    expect(requestCount).toBe(1)
  })

  test("reads the current realm and administrator session over cookie routes", async () => {
    const urls: string[] = []
    const api = adminApiCreate({
      baseUrl: "https://auth.example",
      fetch: async (input) => {
        const url = String(input)
        urls.push(url)
        if (url.endsWith("/sessions/current"))
          return Response.json({
            session: {
              assurance: "authenticated",
              authenticationMethod: "bootstrap_admin",
              createdAt: 1,
              current: true,
              device: {},
              expiresAt: 900,
              id: "session-1",
              realmId,
              lastUsedAt: 1,
              revokedAt: null,
              subjectId: "admin-1",
              subjectType: "bootstrap_admin",
            },
          })
        return Response.json(realmBody)
      },
    })

    expect((await api.realmGet(realmId)).success).toBe(true)
    expect((await api.sessionCurrent(realmId)).success).toBe(true)
    expect(urls).toEqual([
      `https://auth.example/realms/${realmId}`,
      `https://auth.example/realms/${realmId}/sessions/current`,
    ])
  })
})
