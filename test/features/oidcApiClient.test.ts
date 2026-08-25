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
