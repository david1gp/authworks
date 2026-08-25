import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test"
import type { ProductionRouteContract } from "./productionRouteContract.js"
import type { ProductionRouteGuardContext } from "./productionRouteGuardContext.js"
import type { ProductionSessionContextValue } from "./productionSessionContextValue.js"

const solidRuntimePath = "../../../node_modules/solid-js/dist/dev.js"
mock.module("solid-js", () => import(solidRuntimePath))

let mockLocation: Pick<Location, "hash" | "pathname" | "search"> = {
  hash: "",
  pathname: "/account",
  search: "",
}
let mockSession: ProductionSessionContextValue

mock.module("@solidjs/router", () => ({
  useLocation: () => mockLocation,
}))
mock.module("./productionSessionContextGet.js", () => ({
  productionSessionContextGet: () => mockSession,
}))

type ProductionRouteAppStateCreate =
  typeof import("./productionRouteAppStateCreate.js")["productionRouteAppStateCreate"]

let createRoot: typeof import("solid-js").createRoot
let productionRouteAppStateCreate: ProductionRouteAppStateCreate

beforeAll(async () => {
  createRoot = (await import("solid-js")).createRoot
  productionRouteAppStateCreate = (await import("./productionRouteAppStateCreate.js")).productionRouteAppStateCreate
})

afterAll(() => mock.restore())

const previousWindow = globalThis.window
const cleanups: Array<() => void> = []

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  globalThis.window = previousWindow
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
  organizationSelect: () => undefined,
  realms: [],
  realmSelect: () => undefined,
})

const stateObserve = async (route: ProductionRouteContract, session: ProductionSessionContextValue) => {
  const assignments: string[] = []
  mockSession = session
  globalThis.window = {
    location: {
      ...mockLocation,
      assign: (url: string | URL) => assignments.push(String(url)),
    },
  } as unknown as Window & typeof globalThis

  let dispose: (() => void) | undefined
  const state = createRoot((rootDispose) => {
    dispose = rootDispose
    return productionRouteAppStateCreate(() => route)
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

    mockLocation = { hash: "#details", pathname: "/account/profile", search: "?tab=security" }
    expect((await stateObserve(productionRouteContractMap.account, sessionCreate("anonymous"))).assignments).toEqual([
      "/login?return_to=%2Faccount%2Fprofile%3Ftab%3Dsecurity%23details",
    ])
  })
})
