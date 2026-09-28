import { afterAll, expect, mock, test } from "bun:test"
import { createRoot } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import type { ProductionSessionContextValue } from "../../../ui/production/productionSessionContextValue.js"
import type { OidcConsent } from "../../oidc/public/oidcConsentSchema.js"
import type { AccountAccessStatus } from "./accountAccessStatusSchema.js"

let location = { hash: "#access", pathname: "/demo/account", search: "" }
let navigate: (to: string, options: { replace?: boolean; scroll?: boolean }) => void
mock.module("@solidjs/router", () => ({
  useLocation: () => location,
  useNavigate: () => navigate,
}))

const productionId = "01900000-0000-7000-8000-000000000001"
const consentCreate = (clientId: string): OidcConsent => ({
  clientId,
  createdAt: 1,
  realmId: productionId,
  scope: ["openid", "profile", "email"],
  updatedAt: 2,
  userId: productionId,
})
const apiRevoke = mock(async (_realmId: string, _clientId: string) => ({ success: true as const, data: {} }))
mock.module("./accountAccessApiCreate.js", () => ({
  accountAccessApiCreate: () => ({
    consentList: async () => ({ success: true, data: { items: [consentCreate(productionId)] } }),
    consentRevoke: apiRevoke,
  }),
}))

const { accountConsentsViewStateCreate } = await import("./accountConsentsViewStateCreate.js")
const { accountAccessDemoStateCreate } = await import("./accountAccessDemoStateCreate.js")
const { accountAccessProductionStateCreate } = await import("./accountAccessProductionStateCreate.js")

afterAll(() => mock.restore())

function locationCreate(initialSearch = "?fixture=keep&accountSession=other", pathname = "/demo/account") {
  const search = createSignalObject(initialSearch)
  const navigations: { to: string; options: { replace?: boolean; scroll?: boolean } }[] = []
  location = {
    hash: "#access",
    pathname,
    get search() {
      return search.get()
    },
  }
  navigate = (to, options) => {
    navigations.push({ to, options })
    search.set(new URL(to, "https://auth.example.com").search)
  }
  return { navigations, search }
}

function fixtureCreate(initialSearch?: string) {
  const route = locationCreate(initialSearch)
  const consents = createSignalObject([consentCreate("analytics-dashboard"), consentCreate(productionId)])
  const error = createSignalObject<string | undefined>(undefined)
  const pendingId = createSignalObject<string | undefined>(undefined)
  const status = createSignalObject<AccountAccessStatus>("ready")
  const onRevoke = mock(async (_clientId: string) => {})
  const state = accountConsentsViewStateCreate({
    consents: consents.get,
    error: error.get,
    onRevoke,
    pendingId: pendingId.get,
    status: status.get,
  })
  return { ...route, consents, error, onRevoke, pendingId, state, status }
}

test("consent summaries reflect current counts and distinguish unknown or inaccessible data from an empty list", () => {
  createRoot((dispose) => {
    const fixture = fixtureCreate()
    expect(fixture.state.summaryValue()).toBe("2 application consents")
    fixture.consents.set([consentCreate(productionId)])
    expect(fixture.state.summaryValue()).toBe("1 application consent")
    fixture.status.set("loading")
    expect(fixture.state.summaryValue()).toBe("Loading")
    expect(fixture.state.boundary().state).toBe("loading")
    fixture.error.set("Unable to load consents")
    fixture.status.set("error")
    expect(fixture.state.summaryValue()).toBe("This account information could not be loaded.")
    expect(fixture.state.boundary()).toEqual({ detail: "Unable to load consents", state: "error" })
    fixture.status.set("permission-denied")
    expect(fixture.state.summaryValue()).toBe("Unavailable")
    expect(fixture.state.boundary().state).toBe("inaccessible")
    fixture.status.set("expired")
    expect(fixture.state.summaryValue()).toBe("Unavailable")
    fixture.consents.set([])
    fixture.status.set("empty")
    expect(fixture.state.summaryValue()).toBe("0 application consents")
    expect(fixture.state.boundary().state).toBe("ready")
    expect(fixture.onRevoke).not.toHaveBeenCalled()
    dispose()
  })
})

test("individual consent dialogs preserve other query state and the anchor without mutating data", () => {
  createRoot((dispose) => {
    const fixture = fixtureCreate()
    fixture.state.dialogOpenChange("analytics-dashboard", true)
    expect(fixture.state.dialogOpen("analytics-dashboard")).toBe(true)
    expect(fixture.state.dialogOpen(productionId)).toBe(false)
    fixture.state.dialogOpenChange(productionId, true)
    fixture.state.dialogOpenChange("analytics-dashboard", false)
    expect(fixture.state.dialogOpen("analytics-dashboard")).toBe(false)
    expect(fixture.state.dialogOpen(productionId)).toBe(true)
    fixture.state.dialogOpenChange(productionId, false)
    expect(fixture.search.get()).toBe("?fixture=keep&accountSession=other")
    expect(
      fixture.navigations.every(({ to, options }) => to.endsWith("#access") && options.replace && !options.scroll),
    ).toBe(true)
    expect(fixture.consents.get()).toHaveLength(2)
    expect(fixture.onRevoke).not.toHaveBeenCalled()
    dispose()
  })
})

test("URL-held dialogs support demo slugs and production IDs but reject missing, invalid and removed clients", () => {
  createRoot((dispose) => {
    const fixture = fixtureCreate("?accountConsent=analytics-dashboard")
    expect(fixture.state.dialogOpen("analytics-dashboard")).toBe(true)
    fixture.search.set(`?accountConsent=${productionId}`)
    expect(fixture.state.dialogOpen(productionId)).toBe(true)
    fixture.status.set("loading")
    expect(fixture.state.dialogOpen(productionId)).toBe(false)
    fixture.state.dialogOpenChange("analytics-dashboard", true)
    expect(fixture.navigations).toHaveLength(0)
    fixture.status.set("ready")
    fixture.consents.set([])
    expect(fixture.state.dialogOpen(productionId)).toBe(false)
    for (const search of ["?accountConsent=", "?accountConsent=missing", "?accountConsent=%3Cscript%3E"]) {
      fixture.search.set(search)
      expect(fixture.state.dialogOpen("analytics-dashboard")).toBe(false)
    }
    fixture.state.dialogOpenChange("missing", true)
    expect(fixture.navigations).toHaveLength(0)
    dispose()
  })
})

test("revocation requires an open consent dialog and blocks pending and duplicate confirmation requests", async () => {
  await createRoot(async (dispose) => {
    const fixture = fixtureCreate()
    await fixture.state.consentRevoke("analytics-dashboard")
    fixture.state.dialogOpenChange("analytics-dashboard", true)
    fixture.pendingId.set("consent:other")
    await fixture.state.consentRevoke("analytics-dashboard")
    fixture.pendingId.set(undefined)
    let finish: () => void = () => {}
    fixture.onRevoke.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    const revoke = fixture.state.consentRevoke("analytics-dashboard")
    await fixture.state.consentRevoke("analytics-dashboard")
    await fixture.state.consentRevoke(productionId)
    expect(fixture.onRevoke).toHaveBeenCalledTimes(1)
    expect(fixture.state.revokeDisabled("analytics-dashboard")).toBe(true)
    finish()
    await revoke
    expect(fixture.state.dialogOpen("analytics-dashboard")).toBe(true)
    expect(fixture.state.revokeDisabled("analytics-dashboard")).toBe(false)
    dispose()
  })
})

test("failed revocation retains its selection for retry and success only clears the revoked client's dialog", async () => {
  await createRoot(async (dispose) => {
    const fixture = fixtureCreate()
    fixture.state.dialogOpenChange("analytics-dashboard", true)
    fixture.onRevoke.mockImplementation(async () => {
      fixture.error.set("Revocation failed")
      fixture.status.set("error")
    })
    await fixture.state.consentRevoke("analytics-dashboard")
    expect(fixture.search.get()).toContain("accountConsent=analytics-dashboard")
    expect(fixture.consents.get()).toHaveLength(2)
    expect(fixture.state.boundary().detail).toBe("Revocation failed")
    fixture.status.set("ready")
    expect(fixture.state.dialogOpen("analytics-dashboard")).toBe(true)
    fixture.onRevoke.mockImplementation(async (id) => {
      fixture.state.dialogOpenChange(productionId, true)
      fixture.consents.set(fixture.consents.get().filter((consent) => consent.clientId !== id))
    })
    await fixture.state.consentRevoke("analytics-dashboard")
    expect(fixture.state.dialogOpen(productionId)).toBe(true)
    expect(fixture.search.get()).toContain(`accountConsent=${productionId}`)
    dispose()
  })
})

for (const mode of ["demo", "production"] as const) {
  test(`${mode} consent details keep the existing confirmation: cancellation preserves access and acceptance removes only that client`, async () => {
    const previousWindow = globalThis.window
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { origin: "https://auth.example.com", search: "" } },
    })
    try {
      await createRoot(async (dispose) => {
        const route = locationCreate("?fixture=keep", mode === "demo" ? "/demo/account" : "/account")
        const session = {
          guard: { realm: { realmId: productionId, status: "available" } },
          organizationSwitchPending: () => false,
        } as ProductionSessionContextValue
        const access =
          mode === "demo"
            ? accountAccessDemoStateCreate(() => "consents")
            : accountAccessProductionStateCreate(() => "consents", { session })
        await Promise.resolve()
        await Promise.resolve()
        const state = accountConsentsViewStateCreate({
          consents: access.consents,
          error: access.error,
          onRevoke: access.consentRevoke,
          pendingId: access.pendingId,
          status: access.status,
        })
        const clientId = access.consents()[0]!.clientId
        const originalCount = access.consents().length
        const previousApiCalls = apiRevoke.mock.calls.length
        state.dialogOpenChange(clientId, true)
        expect(access.confirmation.open()).toBe(false)
        expect(apiRevoke.mock.calls.length).toBe(previousApiCalls)
        const canceled = state.consentRevoke(clientId)
        expect(access.confirmation.message()).toBe(`Revoke access for ${clientId}?`)
        access.confirmation.cancel()
        await canceled
        expect(access.consents()).toHaveLength(originalCount)
        expect(state.dialogOpen(clientId)).toBe(true)
        expect(apiRevoke.mock.calls.length).toBe(previousApiCalls)
        const accepted = state.consentRevoke(clientId)
        expect(access.confirmation.open()).toBe(true)
        access.confirmation.accept()
        await accepted
        expect(access.consents()).toHaveLength(originalCount - 1)
        expect(access.consents().some((consent) => consent.clientId === clientId)).toBe(false)
        expect(access.notice()).toBe("revoked")
        expect(state.dialogOpen(clientId)).toBe(false)
        expect(route.search.get()).toBe("?fixture=keep")
        expect(apiRevoke.mock.calls.length).toBe(previousApiCalls + (mode === "production" ? 1 : 0))
        dispose()
      })
    } finally {
      Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow })
    }
  })
}
