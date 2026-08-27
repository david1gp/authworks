import { describe, expect, test } from "bun:test"
import { accountDemoUserFixture } from "../../src/features/account/ui/accountDemoUserFixture.js"
import { passwordApiClientCreate } from "../../src/features/passwords/client/passwordApiClientCreate.js"
import { userApiClientCreate } from "../../src/features/users/client/userApiClientCreate.js"
import { httpDateFormat } from "../../src/platform/http/httpDateFormat.js"

describe("account browser clients", () => {
  test("subject-bound mutations acquire and send CSRF tokens", async () => {
    const requests: { init?: RequestInit; url: string }[] = []
    const fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      requests.push({ init, url })
      if (url.endsWith("/sessions/csrf")) return jsonResponse({ csrfToken: "deterministic-csrf" })
      if (url.endsWith("/me/password")) return jsonResponse({ changed: true })
      return jsonResponse({ user: accountDemoUserFixture })
    }
    const users = userApiClientCreate({ baseUrl: "https://auth.example.test", fetch })
    const passwords = passwordApiClientCreate({ baseUrl: "https://auth.example.test", fetch })

    expect((await users.userMeProfileUpdate("realm-one", { displayName: "Updated name" })).success).toBe(true)
    expect(
      (await passwords.passwordMeChange("realm-one", { currentPassword: "old", newPassword: "new" })).success,
    ).toBe(true)
    expect((await users.userMeDelete("realm-one")).success).toBe(true)

    const mutations = requests.filter((request) => !request.url.endsWith("/sessions/csrf"))
    expect(requests.filter((request) => request.url.endsWith("/sessions/csrf"))).toHaveLength(3)
    expect(mutations.map((request) => request.init?.method)).toEqual(["PATCH", "POST", "DELETE"])
    for (const mutation of mutations) {
      expect(new Headers(mutation.init?.headers).get("x-csrf-token")).toBe("deterministic-csrf")
      expect(mutation.init?.credentials).toBe("include")
    }
  })

  test("only the current-user GET opts out of browser caching while generic GET stays conditional", async () => {
    const requests: Request[] = []
    const fetch = async (input: string | URL | Request, init?: RequestInit) => {
      requests.push(new Request(input, init))
      return jsonResponse(
        String(input).endsWith("/me")
          ? { capabilities: { realmRead: true }, user: accountDemoUserFixture }
          : { user: accountDemoUserFixture },
      )
    }
    const users = userApiClientCreate({ baseUrl: "https://auth.example.test", fetch })
    const ifModifiedSince = new Date("2026-08-19T12:34:56.000Z")

    expect((await users.userMeGet("realm-one", { ifModifiedSince })).success).toBe(true)
    expect((await users.userGet("realm-one", "user-one", { ifModifiedSince })).success).toBe(true)

    expect(requests[0]?.cache).toBe("no-store")
    expect(requests[0]?.headers.get("if-modified-since")).toBeNull()
    expect(requests[1]?.cache).toBe("default")
    expect(requests[1]?.headers.get("if-modified-since")).toBe(httpDateFormat(ifModifiedSince))
  })
})

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, status: 200 })
}
