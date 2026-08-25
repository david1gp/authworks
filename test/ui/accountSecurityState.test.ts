import { afterEach, describe, expect, mock, test } from "bun:test"

mock.module("solid-js", () => ({
  createEffect: (effect: () => unknown) => effect(),
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (dependency: () => unknown, handler: (value: unknown) => unknown) => () => handler(dependency()),
  onCleanup: () => undefined,
}))

const { accountSecurityProductionStateCreate } = await import(
  "../../src/features/account/ui/accountSecurityProductionStateCreate.js"
)

const originalFetch = globalThis.fetch
const originalWindow = globalThis.window

afterEach(() => {
  globalThis.fetch = originalFetch
  Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow })
})

describe("account security external identity state", () => {
  test("keeps provider callback confirmation explicit before linking in the production adapter", async () => {
    let linked = false
    let messageHandler: ((event: MessageEvent<unknown>) => void) | undefined
    const popup = {
      close: mock(() => undefined),
      location: { href: "" },
    }
    const browserWindow = {
      addEventListener: (_type: string, handler: EventListenerOrEventListenerObject) => {
        messageHandler = handler as (event: MessageEvent<unknown>) => void
      },
      confirm: () => true,
      location: { origin: "https://auth.example.test" },
      open: () => popup,
      removeEventListener: () => undefined,
    } as unknown as Window
    Object.defineProperty(globalThis, "window", { configurable: true, value: browserWindow })
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith("/sessions/csrf")) return jsonResponse({ csrfToken: "csrf-token" })
      if (url.endsWith("/me/external-identities"))
        return jsonResponse({
          items: linked
            ? [
                {
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
              ]
            : [],
        })
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
          callbackOrigin: "https://auth.example.test",
          expiresAt: 600,
          messageNonce: "message-nonce",
          providerId: "provider-google",
        })
      linked = true
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
    }) as typeof fetch

    const state = accountSecurityProductionStateCreate({
      apiBaseUrl: "https://api.example.test",
      realmId: () => "realm-one",
      screen: () => "identities",
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(state.identityProviders().map((provider) => provider.id)).toEqual(["provider-google"])
    expect(state.identityProviderLinked("provider-google")).toBe(false)

    await state.identityLinkStart("provider-google")
    expect(popup.location.href).toContain("https://accounts.example.test/authorize")
    const callback = {
      confirmationToken: "confirmation-token",
      expiresAt: 600,
      kind: "link_confirmation" as const,
      messageNonce: "message-nonce",
      providerId: "provider-google",
    }
    messageHandler?.({
      data: callback,
      origin: "https://evil.example.test",
      source: popup,
    } as unknown as MessageEvent<unknown>)
    messageHandler?.({
      data: callback,
      origin: "https://api.example.test",
      source: {},
    } as unknown as MessageEvent<unknown>)
    messageHandler?.({
      data: { kind: "link_confirmation" },
      origin: "https://api.example.test",
      source: popup,
    } as unknown as MessageEvent<unknown>)
    messageHandler?.({
      data: { ...callback, messageNonce: "wrong-nonce" },
      origin: "https://api.example.test",
      source: popup,
    } as unknown as MessageEvent<unknown>)
    messageHandler?.({
      data: { ...callback, providerId: "provider-other" },
      origin: "https://auth.example.test",
      source: popup,
    } as unknown as MessageEvent<unknown>)
    expect(state.identityLinkConfirmation()).toBeUndefined()
    messageHandler?.({
      data: callback,
      origin: "https://auth.example.test",
      source: popup as unknown as Window,
    } as unknown as MessageEvent<unknown>)
    expect(state.identityLinkConfirmation()).toMatchObject({ kind: "link_confirmation" })
    messageHandler?.({
      data: callback,
      origin: "https://auth.example.test",
      source: popup,
    } as unknown as MessageEvent<unknown>)
    expect(state.identityLinkConfirmation()).toMatchObject({ confirmationToken: "confirmation-token" })

    await state.identityLinkConfirm()

    expect(state.identityLinkConfirmation()).toBeUndefined()
    expect(state.identityProviderLinked("provider-google")).toBe(true)
  })

  test("renders safe refresh-token state and reloads after family revocation", async () => {
    let revoked = false
    const browserWindow = {
      addEventListener: () => undefined,
      confirm: () => true,
      location: { origin: "https://auth.example.test" },
      removeEventListener: () => undefined,
    } as unknown as Window
    Object.defineProperty(globalThis, "window", { configurable: true, value: browserWindow })
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith("/sessions/csrf")) return jsonResponse({ csrfToken: "csrf-token" })
      if (url.endsWith("/me/refresh-tokens"))
        return jsonResponse({
          items: [
            {
              clientId: "01900000-0000-7000-8000-000000000031",
              clientName: "Acme Dashboard",
              createdAt: 1,
              expiresAt: 2,
              familyId: "01900000-0000-7000-8000-000000000032",
              lastUsedAt: 1,
              revokedAt: revoked ? 3 : null,
              scope: ["openid"],
              status: revoked ? "revoked" : "active",
            },
          ],
        })
      revoked = true
      return jsonResponse({ revoked: true })
    }) as typeof fetch

    const state = accountSecurityProductionStateCreate({
      apiBaseUrl: "https://api.example.test",
      realmId: () => "realm-one",
      screen: () => "refresh-tokens",
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(state.refreshTokens()).toHaveLength(1)
    expect(state.refreshTokens()[0]).not.toHaveProperty("tokenHash")
    await state.refreshTokenRevoke("01900000-0000-7000-8000-000000000032")
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(state.refreshTokens()[0]?.status).toBe("revoked")
  })
})

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, status: 200 })
}
