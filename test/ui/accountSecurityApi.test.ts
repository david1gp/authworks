import { describe, expect, test } from "bun:test"
import { accountSecurityApiCreate } from "../../src/features/account/ui/accountSecurityApiCreate.js"

describe("account security external identity API", () => {
  test("uses the authenticated /me provider, callback, confirmation, and unlink surfaces", async () => {
    const requests: { readonly init?: RequestInit; readonly url: string }[] = []
    const fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      requests.push({ init, url })
      if (url.endsWith("/sessions/csrf")) return jsonResponse({ csrfToken: "csrf-token" })
      if (url.endsWith("/me/external-identities")) return jsonResponse({ items: [] })
      if (url.endsWith("/external-identity-providers"))
        return jsonResponse({
          items: [
            {
              allowAccountCreation: true,
              clientId: "client",
              createdAt: 1,
              displayName: "Google",
              enabled: true,
              id: "provider-google",
              realmId: "realm-one",
              redirectUri: "https://auth.example.test/callback",
              scopes: ["openid"],
              type: "google",
              updatedAt: 1,
              version: 1,
            },
          ],
        })
      if (url.includes("/link/start"))
        return jsonResponse({
          authorizationUrl: "https://accounts.example.test/authorize?state=opaque",
          callbackOrigin: "https://account.example.test",
          expiresAt: 600,
          providerId: "provider-google",
        })
      if (url.includes("/link/complete"))
        return jsonResponse({
          externalIdentity: {
            createdAt: 2,
            displayName: "Avery Stone",
            email: "avery@example.com",
            emailVerified: true,
            externalSubject: "subject-1",
            id: "identity-1",
            providerId: "provider-google",
            providerType: "google",
            realmId: "realm-one",
            updatedAt: 2,
            userId: "user-one",
            username: "avery",
            version: 1,
          },
          linked: true,
        })
      if (url.includes("/callback?"))
        return jsonResponse({
          confirmationToken: "confirmation-token",
          expiresAt: 600,
          kind: "link_confirmation",
          messageNonce: "message-nonce",
          providerId: "provider-google",
        })
      return jsonResponse({ removed: true })
    }

    const api = accountSecurityApiCreate({ baseUrl: "https://auth.example.test", fetch })
    expect((await api.identityProvidersList("realm-one")).success).toBe(true)
    expect(new URL(requests[0]?.url ?? "https://invalid").pathname).toBe(
      "/realms/realm-one/me/external-identity-providers",
    )
    expect((await api.identitiesList("realm-one")).success).toBe(true)
    expect((await api.identityLinkStart("realm-one", "provider-google")).success).toBe(true)
    expect((await api.identityCallback("realm-one", "provider-google", "code", "state")).success).toBe(true)
    expect(
      (
        await api.identityLinkComplete("realm-one", "provider-google", {
          confirm: true,
          confirmationToken: "confirmation-token",
        })
      ).success,
    ).toBe(true)
    expect((await api.identityUnlink("realm-one", "provider-google", "subject-1")).success).toBe(true)

    const mutations = requests.filter(
      (request) => request.init?.method !== "GET" && !request.url.endsWith("/sessions/csrf"),
    )
    expect(mutations.map((request) => new URL(request.url).pathname)).toEqual([
      "/realms/realm-one/me/external-identities/provider-google/link/start",
      "/realms/realm-one/me/external-identities/provider-google/link/complete",
      "/realms/realm-one/me/external-identities/provider-google/subject-1",
    ])
    expect(requests.filter((request) => request.url.endsWith("/sessions/csrf"))).toHaveLength(3)
    for (const request of mutations) {
      expect(new Headers(request.init?.headers).get("x-csrf-token")).toBe("csrf-token")
      expect(request.init?.credentials).toBe("include")
    }
  })
})

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, status: 200 })
}
