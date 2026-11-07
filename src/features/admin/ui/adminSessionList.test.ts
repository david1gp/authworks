import { describe, expect, mock, test } from "bun:test"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { ListQuery } from "../../../platform/http/listQuerySchema.js"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import { adminApiCreate } from "./adminApiCreate.js"
import { adminDemoAdapterCreate } from "./adminDemoAdapterCreate.js"
import { adminDemoUserSessionsFixture } from "./adminDemoUserSessionsFixture.js"
import { adminSessionProductionAdapterCreate } from "./adminSessionProductionAdapterCreate.js"

// Plain `bun test` resolves Solid's server runtime, whose effects do not run.
// Use the real client runtime so initial loads and reactive pagination are exercised.
const solidRuntimePath = "../../../../node_modules/solid-js/dist/solid.js"
const solidRuntime = await import(solidRuntimePath)
mock.module("solid-js", () => solidRuntime)
const [{ createRoot, createSignal }, { adminPageStateCreate }] = await Promise.all([
  import("solid-js"),
  import("./adminPageStateCreate.js"),
])

async function solidFlush() {
  for (let i = 0; i < 10; i++) await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe("administrator session list", () => {
  test.each([
    ["success", "ready"],
    ["empty", "empty"],
    ["loading", "loading"],
    ["error", "error"],
    ["permission-denied", "permission-denied"],
    ["expired", "expired"],
  ] as const)("loads the %s demo list as %s instead of probing sign-in", async (fixtureState, expectedStatus) => {
    let currentProbed = false
    const adapter = adminDemoAdapterCreate((): DemoFixtureState => fixtureState, { signedInInitially: true })
    const { page, dispose } = createRoot((dispose) => ({
      dispose,
      page: adminPageStateCreate({
        adapter: {
          ...adapter,
          sessionCurrent: async () => {
            currentProbed = true
            return adapter.sessionCurrent()
          },
        },
        confirm: () => false,
        screen: () => "sessions",
      }),
    }))
    await Promise.resolve()
    expect(page.status()).toBe(expectedStatus)
    expect(page.sessions()).toEqual(fixtureState === "success" ? adminDemoUserSessionsFixture : [])
    expect(currentProbed).toBe(false)
    dispose()
  })

  test("forwards cursor queries and supports returning from an empty final page", async () => {
    const queries: (ListQuery | undefined)[] = []
    const { page, dispose } = createRoot((dispose) => ({
      dispose,
      page: adminPageStateCreate({
        adapter: {
          ...adminDemoAdapterCreate(() => "success"),
          sessionList: async (query) => {
            queries.push(query)
            return resultCreate(
              query?.pageToken === undefined
                ? { items: [...adminDemoUserSessionsFixture], nextPageToken: "next-sessions" }
                : { items: [] },
            )
          },
        },
        confirm: () => false,
        pageSize: 2,
        screen: () => "sessions",
      }),
    }))
    await Promise.resolve()
    expect(page.hasNextPage()).toBe(true)
    expect(page.hasPreviousPage()).toBe(false)
    page.pageNext()
    await Promise.resolve()
    expect(page.status()).toBe("empty")
    expect(page.hasNextPage()).toBe(false)
    expect(page.hasPreviousPage()).toBe(true)
    page.pagePrevious()
    await Promise.resolve()
    expect(page.status()).toBe("ready")
    expect(queries).toEqual([{ pageSize: 2 }, { pageSize: 2, pageToken: "next-sessions" }, { pageSize: 2 }])
    dispose()
  })

  test("binds the selected production realm and pagination to the cookie-backed session list API", async () => {
    const requests: { readonly url: string; readonly credentials: RequestCredentials | undefined }[] = []
    const api = adminApiCreate({
      baseUrl: "https://authworks.test",
      fetch: async (input, init) => {
        requests.push({ credentials: init?.credentials, url: String(input) })
        return Response.json({ items: adminDemoUserSessionsFixture, nextPageToken: "next-sessions" })
      },
    })
    let realmId = "realm-one"
    const adapter = adminSessionProductionAdapterCreate({ api, realmId: () => realmId })
    const result = await adapter.sessionList({ pageSize: 2, pageToken: "previous-sessions" })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.nextPageToken).toBe("next-sessions")
    const request = requests[0]
    expect(request?.credentials).toBe("include")
    const url = new URL(request?.url ?? "")
    expect(url.pathname).toBe("/realms/realm-one/admin/sessions")
    expect(url.searchParams.get("pageSize")).toBe("2")
    expect(url.searchParams.get("pageToken")).toBe("previous-sessions")
    realmId = ""
    const missingRealm = await adapter.sessionList()
    expect(missingRealm.success).toBe(false)
    expect(requests).toHaveLength(1)
  })

  test("forwards the URL search to the adapter and renders the loaded page verbatim", async () => {
    const queries: (ListQuery | undefined)[] = []
    const reversed = [...adminDemoUserSessionsFixture].reverse()
    const { page, dispose } = createRoot((dispose) => ({
      dispose,
      page: adminPageStateCreate({
        adapter: {
          ...adminDemoAdapterCreate(() => "success"),
          sessionList: async (query) => {
            queries.push(query)
            return resultCreate({ items: reversed })
          },
        },
        confirm: () => false,
        screen: () => "sessions",
        sessionListSearch: () => "ALEX",
      }),
    }))
    await solidFlush()
    expect(queries).toEqual([{ pageSize: 20, search: "ALEX" }])
    // The server already filtered and sorted; the view renders the loaded page as-is.
    expect(page.sessions()).toEqual(reversed)
    expect(page.sessionSearch()).toBe("ALEX")
    dispose()
  })

  test("restarts from the first page when the URL search changes", async () => {
    const queries: (ListQuery | undefined)[] = []
    const firstSession = adminDemoUserSessionsFixture[0]
    if (firstSession === undefined) throw new Error("The first session fixture is missing.")
    const [search, setSearch] = createSignal("")
    const { page, dispose } = createRoot((dispose) => ({
      dispose,
      page: adminPageStateCreate({
        adapter: {
          ...adminDemoAdapterCreate(() => "success"),
          sessionList: async (query?) => {
            queries.push(query)
            if (query?.search === "alex") return resultCreate({ items: [firstSession] })
            return resultCreate(
              query?.pageToken === undefined
                ? { items: [...adminDemoUserSessionsFixture], nextPageToken: "next-sessions" }
                : { items: [] },
            )
          },
        },
        confirm: () => false,
        pageSize: 2,
        screen: () => "sessions",
        sessionListSearch: search,
      }),
    }))
    await solidFlush()
    expect(queries).toEqual([{ pageSize: 2 }])
    page.pageNext()
    await solidFlush()
    expect(queries).toEqual([{ pageSize: 2 }, { pageSize: 2, pageToken: "next-sessions" }])
    expect(page.hasPreviousPage()).toBe(true)
    setSearch("alex")
    await solidFlush()
    expect(page.hasPreviousPage()).toBe(false)
    expect(page.sessions()).toEqual([firstSession])
    expect(queries.at(-1)).toEqual({ pageSize: 2, search: "alex" })
    dispose()
  })

  test("demo adapter filters sessions by the search query", async () => {
    const adapter = adminDemoAdapterCreate(() => "success")
    const unfiltered = await adapter.sessionList()
    expect(unfiltered.success).toBe(true)
    if (unfiltered.success) expect(unfiltered.data.items).toHaveLength(2)
    const byName = await adapter.sessionList({ search: "aLeX" })
    expect(byName.success).toBe(true)
    if (byName.success)
      expect(byName.data.items.map((item) => item.id).sort()).toEqual(["session-admin-desktop", "session-admin-mobile"])
    const byIp = await adapter.sessionList({ search: "192.0.2.10" })
    expect(byIp.success).toBe(true)
    if (byIp.success) expect(byIp.data.items.map((item) => item.id)).toEqual(["session-admin-desktop"])
    const byRegion = await adapter.sessionList({ search: "california" })
    expect(byRegion.success).toBe(true)
    if (byRegion.success) expect(byRegion.data.items.map((item) => item.id)).toEqual(["session-admin-mobile"])
    const noMatch = await adapter.sessionList({ search: "no-such-session" })
    expect(noMatch.success).toBe(true)
    if (noMatch.success) expect(noMatch.data.items).toHaveLength(0)
  })
})
