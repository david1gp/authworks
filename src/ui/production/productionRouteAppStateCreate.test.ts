import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test"
import { createSignal } from "solid-js"
import type { ProductionRouteContract } from "./productionRouteContract.js"
import type { ProductionRouteGuardContext } from "./productionRouteGuardContext.js"
import type { ProductionSessionContextValue } from "./productionSessionContextValue.js"

let mockLocation: Pick<Location, "hash" | "pathname" | "search"> = {
  hash: "",
  pathname: "/account",
  search: "",
}

mock.module("@solidjs/router", () => ({
  useLocation: () => mockLocation,
}))
const previousWindow = globalThis.window
const cleanups: Array<() => void> = []
let createRoot: typeof import("solid-js").createRoot
let productionRouteAppStateCreate: typeof import("./productionRouteAppStateCreate.js")["productionRouteAppStateCreate"]

beforeAll(async () => {
  createRoot = (await import("solid-js")).createRoot
  productionRouteAppStateCreate = (await import("./productionRouteAppStateCreate.js")).productionRouteAppStateCreate
})

afterAll(() => mock.restore())

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow })
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
})

const sessionCreate = (
  authentication: ProductionRouteGuardContext["authentication"],
): ProductionSessionContextValue => ({
  actorLabel: "",
  guard: {
    authentication,
    organization: "missing",
    permission: "not-required",
    realm: { realmId: "realm-1", status: "available" },
  },
  impersonation: null,
  organizations: [],
  organizationSelect: async () => ({ success: true as const, data: undefined }),
  organizationSwitchPending: () => false,
  realms: [],
})

const stateObserve = async (route: ProductionRouteContract, session: ProductionSessionContextValue) => {
  const assignments: string[] = []
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        ...mockLocation,
        assign: (url: string | URL) => assignments.push(String(url)),
      },
    },
  })

  let dispose: (() => void) | undefined
  const state = createRoot((rootDispose) => {
    dispose = rootDispose
    return productionRouteAppStateCreate(() => route, { location: mockLocation, session })
  })
  cleanups.push(() => dispose?.())
  await Promise.resolve()
  await Promise.resolve()
  return { assignments, state }
}

describe("productionRouteAppStateCreate authentication redirect", () => {
  test("redirects anonymous protected routes while leaving public, loading, and authenticated states alone", async () => {
    const { productionRouteContractMap } = await import("./productionRouteContractMap.js")

    mockLocation = { hash: "", pathname: "/login/password", search: "" }
    expect((await stateObserve(productionRouteContractMap.login, sessionCreate("anonymous"))).assignments).toEqual([])

    mockLocation = { hash: "", pathname: "/account", search: "" }
    expect((await stateObserve(productionRouteContractMap.account, sessionCreate("loading"))).assignments).toEqual([])
    expect(
      (
        await stateObserve(
          productionRouteContractMap.account,
          sessionCreate({ status: "authenticated", userId: "user-1" }),
        )
      ).assignments,
    ).toEqual([])

    mockLocation = { hash: "#details", pathname: "/account", search: "?tab=security" }
    const anonymousAccount = await stateObserve(productionRouteContractMap.account, sessionCreate("anonymous"))
    expect(anonymousAccount.assignments).toEqual(["/login?return_to=%2Faccount%3Ftab%3Dsecurity%23details"])
  })

  test("keeps an authenticated account route in place when its organization context changes", async () => {
    const { productionRouteContractMap } = await import("./productionRouteContractMap.js")
    const [organization, setOrganization] = createSignal<ProductionRouteGuardContext["organization"]>({
      organizationId: "organization-1",
      status: "available",
    })
    const baseSession = sessionCreate({ status: "authenticated", userId: "user-1" })
    const session = {
      ...baseSession,
      guard: {
        ...baseSession.guard,
        get organization() {
          return organization()
        },
      },
    }

    mockLocation = { hash: "#access", pathname: "/account", search: "?organization=organization-1" }
    const observed = await stateObserve(productionRouteContractMap.account, session)
    expect(observed.assignments).toEqual([])
    expect(observed.state.guardState()).toMatchObject({
      organizationId: "organization-1",
      status: "authenticated",
    })

    setOrganization({ organizationId: "organization-2", status: "available" })
    expect(observed.assignments).toEqual([])
    expect(observed.state.guardState()).toMatchObject({
      organizationId: "organization-2",
      status: "authenticated",
    })
  })
})
