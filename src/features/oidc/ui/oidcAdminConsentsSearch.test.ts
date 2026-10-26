import { describe, expect, mock, test } from "bun:test"
import { resultCreate } from "../../../platform/errors/resultCreate.js"
import type { UserListQuery } from "../../users/public/userListQuerySchema.js"
import { oidcAdminDemoAdapterCreate } from "./oidcAdminDemoAdapterCreate.js"

// Plain `bun test` resolves Solid's server runtime, whose effects do not run.
// Use the real client runtime so search and cursor changes trigger reloads.
const solidRuntimePath = "../../../../node_modules/solid-js/dist/solid.js"
const solidRuntime = await import(solidRuntimePath)
mock.module("solid-js", () => solidRuntime)
const [{ createRoot, createSignal }, { oidcAdminPageStateCreate }] = await Promise.all([
  import("solid-js"),
  import("./oidcAdminPageStateCreate.js"),
])

const flushEffects = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

const directory = [
  { id: "user-priya", label: "priya.raman@northwind.example" },
  { id: "user-alex", label: "alex.morgan@northwind.example" },
  { id: "user-sam", label: "sam.okafor@northwind.example" },
] as const

describe("administrator consent user search", () => {
  test("the picker issues server search queries and pages beyond the first page", async () => {
    const queries: (UserListQuery | undefined)[] = []
    const { page, dispose } = createRoot((dispose) => {
      const demo = oidcAdminDemoAdapterCreate(() => "success")
      const [searchParam, setSearchParam] = createSignal<string | undefined>(undefined)
      return {
        dispose,
        page: oidcAdminPageStateCreate({
          adapter: {
            ...demo,
            users: async (query) => {
              queries.push(query)
              const term = query?.search?.trim().toLowerCase() ?? ""
              const filtered = directory.filter((user) => user.label.toLowerCase().includes(term))
              const start = query?.pageToken === undefined ? 0 : Number.parseInt(query.pageToken, 10)
              const items = filtered.slice(start, start + 1)
              const next = start + 1 < filtered.length ? String(start + 1) : undefined
              return resultCreate({ items: [...items], ...(next === undefined ? {} : { nextPageToken: next }) })
            },
          },
          clientId: () => undefined,
          confirm: () => false,
          consentUserId: () => undefined,
          consentUserSearch: () => searchParam(),
          consentUserSearchSet: (value) => setSearchParam(value.length === 0 ? undefined : value),
          screen: () => "oidc-consents",
        }),
      }
    })
    await flushEffects()

    expect(queries).toHaveLength(1)
    expect(queries[0]).toEqual({})
    expect(page.users().map((user) => user.id)).toEqual(["user-priya"])
    expect(page.userHasNextPage()).toBe(true)
    expect(page.userHasPreviousPage()).toBe(false)

    page.userPageNext()
    await flushEffects()
    expect(queries.at(-1)).toEqual({ pageToken: "1" })
    expect(page.users().map((user) => user.id)).toEqual(["user-alex"])
    expect(page.userHasPreviousPage()).toBe(true)

    page.userSearchSet("sam")
    await flushEffects()
    // A new search restarts from the first directory page.
    expect(queries.at(-1)).toEqual({ search: "sam" })
    expect(page.userSearch()).toBe("sam")
    expect(page.users().map((user) => user.id)).toEqual(["user-sam"])
    expect(page.userHasNextPage()).toBe(false)
    dispose()
  })
})
