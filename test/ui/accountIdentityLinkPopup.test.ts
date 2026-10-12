import { afterEach, expect, mock, test } from "bun:test"
import { createRoot } from "solid-js"
import { accountSecurityProductionStateCreate } from "../../src/features/account/ui/accountSecurityProductionStateCreate.js"

const cleanups: (() => void)[] = []

afterEach(async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  for (const cleanup of cleanups.splice(0)) cleanup()
})

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, status: 200 })
}

function fixtureCreate(linkStart: (url: string) => Response | undefined) {
  let messageHandler: ((event: MessageEvent<unknown>) => void) | undefined
  const popup = {
    close: mock(() => undefined),
    closed: false,
    location: { href: "" },
  }
  const browserWindow = {
    addEventListener: (_type: string, handler: EventListenerOrEventListenerObject) => {
      messageHandler = handler as (event: MessageEvent<unknown>) => void
    },
    location: { origin: "https://auth.example.test" },
    open: () => popup,
    removeEventListener: () => undefined,
  } as unknown as Window
  Object.defineProperty(globalThis, "window", { configurable: true, value: browserWindow })
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input)
    if (url.endsWith("/sessions/csrf")) return jsonResponse({ csrfToken: "csrf-token-long-enough" })
    const started = linkStart(url)
    if (started !== undefined) return started
    throw new Error(`Unexpected account security request: ${url}`)
  }) as typeof fetch
  let dispose: (() => void) | undefined
  const state = createRoot((rootDispose) => {
    dispose = rootDispose
    return accountSecurityProductionStateCreate({
      apiBaseUrl: "https://api.example.test",
      realmId: () => "realm-one",
      screen: () => "identities",
    })
  })
  if (dispose === undefined) throw new Error("State root did not provide a disposer.")
  cleanups.push(dispose)
  const fireMessage = (data: unknown) =>
    messageHandler?.({
      data,
      origin: "https://auth.example.test",
      source: popup,
    } as unknown as MessageEvent<unknown>)
  return { fireMessage, popup, state }
}

const linkStartResponse = () =>
  jsonResponse({
    authorizationUrl: "https://github.com/login/oauth/authorize?state=opaque",
    callbackOrigin: "https://auth.example.test",
    expiresAt: Date.now() + 600_000,
    messageNonce: "message-nonce",
    providerId: "provider-github",
  })

test("a link failure message from the provider popup surfaces the error", async () => {
  const fixture = fixtureCreate((url) => (url.includes("/link/start") ? linkStartResponse() : undefined))
  await fixture.state.identityLinkStart("provider-github")
  expect(fixture.popup.location.href).toContain("https://github.com/login/oauth/authorize")
  expect(fixture.state.pendingId()).toBe("identity:link:provider-github")

  fixture.fireMessage({
    errorMessage: "The provider request was denied before completing. Try again and approve the request.",
    kind: "link_failure",
    messageNonce: "message-nonce",
    providerId: "provider-github",
  })
  expect(fixture.state.error()).toContain("denied")
  expect(fixture.state.pendingId()).toBeUndefined()
  expect(fixture.state.identityLinkConfirmation()).toBeUndefined()
})

test("closing the provider window without completing surfaces a retry error", async () => {
  const fixture = fixtureCreate((url) => (url.includes("/link/start") ? linkStartResponse() : undefined))
  await fixture.state.identityLinkStart("provider-github")
  expect(fixture.state.pendingId()).toBe("identity:link:provider-github")

  fixture.popup.closed = true
  await new Promise<void>((resolve) => setTimeout(resolve, 800))
  expect(fixture.state.error()).toContain("closed before linking")
  expect(fixture.state.pendingId()).toBeUndefined()
}, 15000)
