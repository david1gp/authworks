import { expect, test } from "bun:test"
import { zitadelApiClientCreate } from "../../src/features/zitadelMigration/client/zitadelApiClientCreate.js"

test("discovers native instance and organization templates, preserves ownership, and deduplicates inheritance", async () => {
  const secret = "template-secret-must-not-escape"
  const calls: { readonly url: string; readonly organizationId: string | null }[] = []
  const api = zitadelApiClientCreate({
    baseUrl: "https://zitadel.test",
    fetch: async (input, init) => {
      const url = String(input)
      const headers = new Headers(init?.headers)
      calls.push({ url, organizationId: headers.get("x-zitadel-orgid") })
      if (url.endsWith("/admin/v1/idps/templates/_search"))
        return Response.json({
          details: { totalResult: "1" },
          result: [
            {
              config: {
                google: { clientId: "google-client", clientSecret: secret, scopes: ["openid", "profile"] },
                options: { isCreationAllowed: true },
              },
              details: { changeDate: "2026-01-02T00:00:00Z", creationDate: "2026-01-01T00:00:00Z", secret },
              id: "instance-google",
              name: "Google",
              owner: "IDP_OWNER_TYPE_SYSTEM",
              state: "IDP_STATE_ACTIVE",
              type: "PROVIDER_TYPE_GOOGLE",
            },
          ],
        })
      return Response.json({
        details: { totalResult: 3 },
        result: [
          {
            config: { google: { clientId: "google-client", scopes: ["openid", "profile"] } },
            id: "instance-google",
            name: "Google inherited",
            owner: "IDP_OWNER_TYPE_SYSTEM",
            state: "IDP_STATE_ACTIVE",
            type: "PROVIDER_TYPE_GOOGLE",
          },
          {
            config: { github: { clientId: "github-client", scopes: ["read:user"] } },
            details: { resourceOwner: "org-1" },
            id: "org-github",
            name: "GitHub",
            owner: "IDP_OWNER_TYPE_ORG",
            state: "IDP_STATE_INACTIVE",
            type: "PROVIDER_TYPE_GITHUB",
          },
          {
            config: {
              azureAd: {
                clientId: "microsoft-client",
                scopes: ["openid"],
                tenant: { tenantId: "tenant-id", secret },
              },
            },
            details: { resourceOwner: "org-1" },
            id: "org-microsoft",
            name: "Microsoft",
            owner: 2,
            state: 1,
            type: 5,
          },
        ],
      })
    },
    pageSize: 100,
    token: "token",
  })

  const result = await api.identityProvidersList(["org-1"])

  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data[0]).toMatchObject({
    id: "instance-google",
    type: "GOOGLE",
    oidcConfig: { clientId: "google-client", scopes: ["openid", "profile"] },
  })
  expect(result.data[0]?.organizationId).toBeUndefined()
  expect(result.data[1]).toMatchObject({ id: "org-github", organizationId: "org-1", type: "GITHUB", enabled: false })
  expect(result.data[2]).toMatchObject({ id: "org-microsoft", organizationId: "org-1", type: "AZURE_AD" })
  expect(result.data).toHaveLength(3)
  expect(JSON.stringify(result)).not.toContain(secret)
  expect(calls).toEqual([
    { url: "https://zitadel.test/admin/v1/idps/templates/_search", organizationId: null },
    { url: "https://zitadel.test/management/v1/idps/templates/_search", organizationId: "org-1" },
  ])
})

test("requires complete template pagination", async () => {
  const offsets: number[] = []
  const api = zitadelApiClientCreate({
    baseUrl: "https://zitadel.test",
    fetch: async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { query: { offset: number } }
      offsets.push(body.query.offset)
      const id = body.query.offset === 0 ? "one" : "two"
      return Response.json({
        details: { totalResult: 2 },
        result: [providerTemplate(id)],
      })
    },
    pageSize: 1,
    token: "token",
  })

  const result = await api.identityProvidersList([])

  expect(result.success).toBe(true)
  if (result.success) expect(result.data.map((provider) => provider.id)).toEqual(["one", "two"])
  expect(offsets).toEqual([0, 1])
})

test("fails closed on permission failures and partial template pages without retaining response secrets", async () => {
  const secret = "permission-response-secret"
  const permissionApi = zitadelApiClientCreate({
    baseUrl: "https://zitadel.test",
    fetch: async () => new Response(JSON.stringify({ secret }), { status: 403 }),
    token: "token",
  })
  const permissionResult = await permissionApi.identityProvidersList([])
  expect(permissionResult.success).toBe(false)
  expect(JSON.stringify(permissionResult)).not.toContain(secret)

  const partialApi = zitadelApiClientCreate({
    baseUrl: "https://zitadel.test",
    fetch: async () => Response.json({ details: { totalResult: 2 }, result: [providerTemplate("one")] }),
    pageSize: 2,
    token: "token",
  })
  const partialResult = await partialApi.identityProvidersList([])
  expect(partialResult.success).toBe(false)
  expect(JSON.stringify(partialResult)).not.toContain(secret)
})

test("does not turn an inherited instance template into an organization-owned provider", async () => {
  const api = zitadelApiClientCreate({
    baseUrl: "https://zitadel.test",
    fetch: async () =>
      Response.json({
        details: { totalResult: 1 },
        result: [
          {
            config: { google: { clientId: "client", scopes: ["openid"] } },
            id: "instance-provider",
            name: "Google",
            owner: "IDP_OWNER_TYPE_SYSTEM",
            state: "IDP_STATE_ACTIVE",
            type: "PROVIDER_TYPE_GOOGLE",
          },
        ],
      }),
    token: "token",
  })

  const result = await api.identityProvidersList(["org-1", "org-2"])

  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data).toHaveLength(1)
  expect(result.data[0]?.id).toBe("instance-provider")
  expect(result.data[0]?.organizationId).toBeUndefined()
})

test("does not map an unsupported native config as a supported provider", async () => {
  const secret = "unsupported-provider-secret"
  const api = zitadelApiClientCreate({
    baseUrl: "https://zitadel.test",
    fetch: async () =>
      Response.json({
        details: { totalResult: 1 },
        result: [
          {
            config: { apple: { clientId: "apple-client", privateKey: secret } },
            id: "apple-provider",
            name: "Apple",
            owner: "IDP_OWNER_TYPE_SYSTEM",
            state: "IDP_STATE_ACTIVE",
            type: "PROVIDER_TYPE_APPLE",
          },
        ],
      }),
    token: "token",
  })

  const result = await api.identityProvidersList([])

  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data[0]).toMatchObject({ id: "apple-provider", type: "APPLE" })
  expect(result.data[0]?.oidcConfig).toBeUndefined()
  expect(JSON.stringify(result)).not.toContain(secret)
})

function providerTemplate(id: string) {
  return {
    config: { google: { clientId: `${id}-client`, scopes: ["openid"] } },
    id,
    name: id,
    owner: "IDP_OWNER_TYPE_SYSTEM",
    state: "IDP_STATE_ACTIVE",
    type: "PROVIDER_TYPE_GOOGLE",
  }
}
