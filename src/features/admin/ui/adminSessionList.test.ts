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
const [{ createRoot }, { adminPageStateCreate }] = await Promise.all([
  import("solid-js"),
  import("./adminPageStateCreate.js"),
])

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
    expect(url.pathname).toBe("/realms/realm-one/sessions")
    expect(url.searchParams.get("pageSize")).toBe("2")
    expect(url.searchParams.get("pageToken")).toBe("previous-sessions")
    realmId = ""
    const missingRealm = await adapter.sessionList()
    expect(missingRealm.success).toBe(false)
    expect(requests).toHaveLength(1)
  })
})
