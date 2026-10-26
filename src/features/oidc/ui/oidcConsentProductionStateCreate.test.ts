import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import type { OidcInteractionDetails } from "../public/oidcInteractionDetailsSchema.js"

type ConsentStateCreate = typeof import("./oidcConsentProductionStateCreate.js")["oidcConsentProductionStateCreate"]
type ConsentClient = {
  oidcConsentBrowserDecide: (
    realmId: string,
    handle: string,
    decision: "approve" | "deny",
  ) => Promise<
    | { readonly data: string; readonly success: true }
    | { readonly code?: string; readonly errorMessage: string; readonly op: string; readonly success: false }
  >
  oidcInteractionBrowserGet: (
    handle: string,
  ) => Promise<
    | { readonly data: OidcInteractionDetails; readonly status: "current"; readonly success: true }
    | { readonly code?: string; readonly errorMessage: string; readonly op: string; readonly success: false }
  >
}

const solidRuntimePath = "../../../../node_modules/solid-js/dist/dev.js"
const solidWebRuntimePath = "../../../../node_modules/solid-js/web/dist/web.js"
mock.module("solid-js", () => import(solidRuntimePath))
mock.module("solid-js/web", () => import(solidWebRuntimePath))

let createRoot: typeof import("solid-js").createRoot
let consentStateCreate: ConsentStateCreate

beforeAll(async () => {
  const solid = await import("solid-js")
  createRoot = solid.createRoot
  consentStateCreate = (await import("./oidcConsentProductionStateCreate.js")).oidcConsentProductionStateCreate
})

afterAll(() => mock.restore())

const handle = "a".repeat(43)
const details: OidcInteractionDetails = {
  client_id: "client-1",
  client_name: "Example app",
  realm_id: "realm-1",
  redirect_uri: "https://client.example/callback",
  scopes: ["openid", "profile", "email", "mystery-scope"],
}

const clientCreate = (overrides: Partial<ConsentClient> = {}): ConsentClient => ({
  oidcConsentBrowserDecide: async () => resultCreate("https://client.example/callback?code=code-1&state=st"),
  oidcInteractionBrowserGet: async () => ({ data: details, status: "current" as const, success: true as const }),
  ...overrides,
})

const flushEffects = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe("production consent state", () => {
  test("a missing interaction handle shows the missing panel without fetching", async () => {
    let calls = 0
    await createRoot(async (dispose) => {
      const state = consentStateCreate({
        assign: () => {},
        client: clientCreate({
          oidcInteractionBrowserGet: async () => {
            calls += 1
            return { data: details, status: "current" as const, success: true as const }
          },
        }),
        search: () => "",
      })
      await flushEffects()
      await state.load()
      expect(state.status()).toBe("missing")
      expect(state.signInHref()).toBe("/login")
      expect(calls).toBe(0)
      dispose()
    })
  })

  test("a malformed interaction handle shows the invalid panel without fetching", async () => {
    let calls = 0
    await createRoot(async (dispose) => {
      const state = consentStateCreate({
        assign: () => {},
        client: clientCreate({
          oidcInteractionBrowserGet: async () => {
            calls += 1
            return { data: details, status: "current" as const, success: true as const }
          },
        }),
        search: () => "?interaction=not-a-handle",
      })
      await flushEffects()
      await state.load()
      expect(state.status()).toBe("invalid")
      expect(calls).toBe(0)
      dispose()
    })
  })

  test("known scopes render plain-language labels and unknown scopes stay raw", async () => {
    await createRoot(async (dispose) => {
      const state = consentStateCreate({
        assign: () => {},
        client: clientCreate(),
        search: () => `?interaction=${handle}`,
      })
      await flushEffects()
      await state.load()
      expect(state.status()).toBe("ready")
      expect(state.details()?.client_name).toBe("Example app")
      expect(state.scopes().map((scope) => scope.label)).toEqual([
        "Verify your identity",
        "Your basic profile",
        "Your email address",
        "mystery-scope",
      ])
      expect(state.scopes().map((scope) => scope.raw)).toEqual(["openid", "profile", "email", "mystery-scope"])
      dispose()
    })
  })

  test("an unauthorized interaction shows the sign-in panel preserving the handle", async () => {
    const assigned: string[] = []
    await createRoot(async (dispose) => {
      const state = consentStateCreate({
        assign: (url) => assigned.push(url),
        client: clientCreate({
          oidcInteractionBrowserGet: async () =>
            resultErrorCodedCreate(
              "oidcApiClientBrowserRequest",
              "Session authorization is required.",
              "oidc.unauthorized",
            ),
        }),
        search: () => `?interaction=${handle}`,
      })
      await flushEffects()
      await state.load()
      expect(state.status()).toBe("unauthenticated")
      expect(state.signInHref()).toBe(`/login?interaction=${handle}`)
      state.signIn()
      expect(assigned).toEqual([`/login?interaction=${handle}`])
      dispose()
    })
  })

  test("an expired or consumed interaction shows the expired panel with a sign-in link", async () => {
    await createRoot(async (dispose) => {
      const state = consentStateCreate({
        assign: () => {},
        client: clientCreate({
          oidcInteractionBrowserGet: async () =>
            resultErrorCodedCreate("oidcApiClientBrowserRequest", "The OIDC interaction is invalid.", "oidc.invalid"),
        }),
        search: () => `?interaction=${handle}`,
      })
      await flushEffects()
      await state.load()
      expect(state.status()).toBe("invalid")
      expect(state.signInHref()).toBe(`/login?interaction=${handle}`)
      dispose()
    })
  })

  test("approve follows the server-provided redirect without rebuilding its parameters", async () => {
    const assigned: string[] = []
    const seen: { decision?: string; handle?: string; realmId?: string } = {}
    const redirect = "https://client.example/callback?code=code-1&state=st"
    await createRoot(async (dispose) => {
      const state = consentStateCreate({
        assign: (url) => assigned.push(url),
        client: clientCreate({
          oidcConsentBrowserDecide: async (realmId, decidedHandle, decision) => {
            seen.decision = decision
            seen.handle = decidedHandle
            seen.realmId = realmId
            return resultCreate(redirect)
          },
        }),
        search: () => `?interaction=${handle}`,
      })
      await flushEffects()
      await state.load()
      await state.approve()
      expect(seen).toEqual({ decision: "approve", handle, realmId: "realm-1" })
      expect(assigned).toEqual([redirect])
      dispose()
    })
  })

  test("deny follows the server-provided access-denied redirect", async () => {
    const assigned: string[] = []
    const redirect = "https://client.example/callback?error=access_denied&state=st"
    await createRoot(async (dispose) => {
      const state = consentStateCreate({
        assign: (url) => assigned.push(url),
        client: clientCreate({
          oidcConsentBrowserDecide: async () => resultCreate(redirect),
        }),
        search: () => `?interaction=${handle}`,
      })
      await flushEffects()
      await state.load()
      await state.deny()
      expect(assigned).toEqual([redirect])
      dispose()
    })
  })

  test("a failed decision returns to the expired panel and releases the pending state", async () => {
    await createRoot(async (dispose) => {
      const state = consentStateCreate({
        assign: () => {},
        client: clientCreate({
          oidcConsentBrowserDecide: async () =>
            resultErrorCodedCreate(
              "oidcApiClientConsentBrowserDecide",
              "The OIDC interaction is invalid.",
              "oidc.invalid",
            ),
        }),
        search: () => `?interaction=${handle}`,
      })
      await flushEffects()
      await state.load()
      expect(state.status()).toBe("ready")
      await state.deny()
      expect(state.status()).toBe("invalid")
      expect(state.deciding()).toBeUndefined()
      dispose()
    })
  })
})
