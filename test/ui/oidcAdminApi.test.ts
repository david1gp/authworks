import { describe, expect, test } from "bun:test"
import { oidcAdminProductionAdapterCreate } from "../../src/features/oidc/ui/oidcAdminProductionAdapterCreate.js"

const realmId = "018f0000-0000-7000-8000-000000000001"
const clientId = "018f0000-0000-7000-8000-000000000041"
const userId = "018f0000-0000-7000-8000-000000000021"

const client = {
  allowedScopes: ["openid"],
  clientType: "confidential",
  createdAt: 1,
  id: clientId,
  name: "Acme Web Portal",
  postLogoutRedirectUris: [],
  realmId,
  redirectUris: ["https://portal.acme.example/callback"],
  requireConsent: true,
  status: "active",
  trusted: false,
  updatedAt: 1,
}

function adapterCreate(responder: (url: string) => Response) {
  const requests: { init?: RequestInit; url: string }[] = []
  const adapter = oidcAdminProductionAdapterCreate({
    baseUrl: "https://auth.example",
    csrfToken: () => "csrf-fixture",
    fetch: async (input, init) => {
      const url = String(input)
      requests.push({ init, url })
      return responder(url)
    },
    realmId: () => realmId,
  })
  return { adapter, requests }
}

describe("OIDC administration production adapter", () => {
  test("reads collections from realm-scoped tenant paths with same-origin cookies", async () => {
    const { adapter, requests } = adapterCreate(() => Response.json({ items: [] }))

    await adapter.clientList()
    await adapter.signingKeyList()
    await adapter.consentList(userId)

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      `/realms/${realmId}/oidc/clients`,
      `/realms/${realmId}/oidc/signing-keys`,
      `/realms/${realmId}/oidc/consents/${userId}`,
    ])
    for (const request of requests) expect(request.init?.credentials).toBe("same-origin")
    // The browser must never reach the operator-only system surface.
    expect(requests.every((request) => !request.url.includes("/system/"))).toBe(true)
  })

  test("requests a bounded page size and forwards the page token", async () => {
    const { adapter, requests } = adapterCreate(() => Response.json({ items: [] }))

    await adapter.clientList("page-2")

    const url = new URL(requests[0]?.url ?? "")
    expect(url.searchParams.get("pageSize")).toBe("25")
    expect(url.searchParams.get("pageToken")).toBe("page-2")
  })

  test("sends the supplied CSRF token on client mutations", async () => {
    const { adapter, requests } = adapterCreate(() => Response.json({ client }))

    await adapter.clientUpdate(clientId, { redirectUris: ["https://portal.acme.example/callback"] })

    expect(requests[0]?.init?.method).toBe("PATCH")
    expect(new Headers(requests[0]?.init?.headers).get("x-csrf-token")).toBe("csrf-fixture")
  })

  test("resolves a fresh CSRF token per mutation when none is supplied", async () => {
    const requests: { init?: RequestInit; url: string }[] = []
    const adapter = oidcAdminProductionAdapterCreate({
      baseUrl: "https://auth.example",
      fetch: async (input, init) => {
        const url = String(input)
        requests.push({ init, url })
        if (url.endsWith("/sessions/csrf")) return Response.json({ csrfToken: "csrf-rotated" })
        return Response.json({ signingKey: { algorithm: "RS256" } })
      },
      realmId: () => realmId,
    })

    await adapter.signingKeyRotate()

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      `/realms/${realmId}/sessions/csrf`,
      `/realms/${realmId}/oidc/signing-keys/rotate`,
    ])
    expect(new Headers(requests[1]?.init?.headers).get("x-csrf-token")).toBe("csrf-rotated")
  })

  test("does not send a mutation when the CSRF exchange fails", async () => {
    let requestCount = 0
    const adapter = oidcAdminProductionAdapterCreate({
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

    const result = await adapter.clientSecretRotate(clientId)

    expect(result.success).toBe(false)
    expect(requestCount).toBe(1)
  })

  test("posts secret rotation and revocation to their dedicated tenant paths", async () => {
    const { adapter, requests } = adapterCreate((url) =>
      url.endsWith("/rotate") ? Response.json({ client, clientSecret: "s".repeat(43) }) : Response.json({ client }),
    )

    const rotated = await adapter.clientSecretRotate(clientId)
    await adapter.clientSecretRevoke(clientId)

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      `/realms/${realmId}/oidc/clients/${clientId}/secret/rotate`,
      `/realms/${realmId}/oidc/clients/${clientId}/secret/revoke`,
    ])
    for (const request of requests) expect(request.init?.method).toBe("POST")
    expect(rotated.success && rotated.data.clientSecret).toBe("s".repeat(43))
  })

  test("revoking a consent posts the client id on the subject's tenant path", async () => {
    const { adapter, requests } = adapterCreate(() => Response.json({ revoked: true }))

    const revoked = await adapter.consentRevoke(userId, clientId)

    expect(new URL(requests[0]?.url ?? "").pathname).toBe(
      `/realms/${realmId}/oidc/consents/${userId}/${clientId}/revoke`,
    )
    expect(revoked.success && revoked.data.revoked).toBe(true)
  })

  test("reads discovery and JWKS from the read-only well-known endpoints", async () => {
    const { adapter, requests } = adapterCreate((url) =>
      url.endsWith("jwks.json") ? Response.json({ keys: [] }) : Response.json({ items: [] }),
    )

    await adapter.jwksGet()

    expect(new URL(requests[0]?.url ?? "").pathname).toBe("/.well-known/jwks.json")
    expect(requests[0]?.init?.method).toBe("GET")
  })

  test("exposes no mutating operation for discovery or JWKS", () => {
    const { adapter } = adapterCreate(() => Response.json({ items: [] }))

    expect(Object.keys(adapter).filter((name) => /discovery|jwks/i.test(name))).toEqual(["discoveryGet", "jwksGet"])
  })

  test("unwraps the envelope and surfaces coded failures", async () => {
    const { adapter } = adapterCreate(() => Response.json({ client }))
    const read = await adapter.clientGet(clientId)
    expect(read.success && read.data.name).toBe("Acme Web Portal")

    const { adapter: denied } = adapterCreate(() =>
      Response.json(
        { error: { code: "oidc.forbidden", message: "Denied.", op: "oidcClientList", status: 403 } },
        { status: 403 },
      ),
    )
    const failure = await denied.clientList()
    expect(!failure.success && failure.code).toBe("oidc.forbidden")
  })
})
