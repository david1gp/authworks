import { afterEach, expect, test } from "bun:test"
import { e2eServiceApiClientCreate } from "../../e2e/harness/e2eServiceApiClientCreate.js"

const previousFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = previousFetch
})

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  })
}

test("service client failures carry the server error code", async () => {
  const seen: string[] = []
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    seen.push(url)
    if (url.includes("/organization-discovery"))
      return jsonResponse({ found: true, organization: { realmId: "realm-1" } }, 200)
    if (url.endsWith("/password/login"))
      return jsonResponse({ authentication: { authenticatedAt: 1, realmId: "realm-1", userId: "service-1" } }, 200)
    if (url.endsWith("/sessions/csrf")) return jsonResponse({ csrfToken: "csrf-1" }, 200)
    return jsonResponse(
      {
        error: {
          code: "users.already-deleted",
          message: "The user has already been deleted.",
          op: "userDelete",
          status: 409,
        },
      },
      409,
    )
  }) as typeof fetch

  const created = await e2eServiceApiClientCreate({
    baseUrl: "http://login.localhost:5190",
    password: "service-secret",
    username: "authworks-e2e-service",
  })
  expect(created.success).toBe(true)
  if (!created.success) return

  const deleted = await created.data.userDelete("realm-1", "user-1")
  expect(deleted.success).toBe(false)
  if (deleted.success) return
  expect("code" in deleted ? deleted.code : undefined).toBe("users.already-deleted")
  expect(deleted.errorMessage).toContain("failed:")
  expect(seen.some((url) => url.includes("/users/user-1"))).toBe(true)
})
