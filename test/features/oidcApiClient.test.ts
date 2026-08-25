import { expect, test } from "bun:test"
import { oidcApiClientCreate } from "../../src/outputs/library/oidc.js"

test("OIDC logout accepts a successful 204 No Content response", async () => {
  const client = oidcApiClientCreate({
    baseUrl: "https://oidc.example.com",
    fetch: async () => new Response(null, { status: 204 }),
  })

  const result = await client.oidcLogout({})

  expect(result).toEqual({ data: undefined, success: true })
})

test("OIDC logout preserves the successful 200 JSON response", async () => {
  const client = oidcApiClientCreate({
    baseUrl: "https://oidc.example.com",
    fetch: async () => Response.json({ revoked: true }),
  })

  const result = await client.oidcLogout({})

  expect(result).toEqual({ data: { revoked: true }, success: true })
})

test("OIDC account refresh-token methods use the authenticated /me surfaces", async () => {
  const requests: { readonly init?: RequestInit; readonly url: string }[] = []
  const client = oidcApiClientCreate({
    baseUrl: "https://oidc.example.com",
    fetch: async (input, init) => {
      const url = String(input)
      requests.push({ init, url })
      if (url.includes("/refresh-tokens") && init?.method === "GET")
        return Response.json({
          items: [
            {
              clientId: "01900000-0000-7000-8000-000000000031",
              clientName: "Acme Dashboard",
              createdAt: 1,
              expiresAt: 2,
              familyId: "01900000-0000-7000-8000-000000000032",
              lastUsedAt: 1,
              revokedAt: null,
              scope: ["openid"],
              status: "active",
            },
          ],
        })
      return Response.json({ revoked: true })
    },
  })

  expect((await client.oidcRefreshTokenMeList("realm-one", { pageSize: 10 })).success).toBe(true)
  expect((await client.oidcRefreshTokenMeRevoke("realm-one", "family-one")).success).toBe(true)
  expect((await client.oidcRefreshTokenMeRevokeAll("realm-one")).success).toBe(true)
  expect(requests.map(({ url, init }) => [new URL(url).pathname, init?.method])).toEqual([
    ["/realms/realm-one/me/refresh-tokens", "GET"],
    ["/realms/realm-one/me/refresh-tokens/family-one/revoke", "POST"],
    ["/realms/realm-one/me/refresh-tokens/revoke-all", "POST"],
  ])
})
