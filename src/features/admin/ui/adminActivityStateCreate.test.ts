import { expect, test } from "bun:test"
import { createRoot, createSignal } from "solid-js"
import { createResult, createResultError } from "#result"
import type { EventListResponse } from "../../events/public/eventListResponseSchema.js"
import type { AdminActivityAdapter } from "./adminActivityAdapter.js"
import { adminActivityStateCreate } from "./adminActivityStateCreate.js"

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

test("organization errors never fall back to the IAM feed; changing to IAM loads it", async () => {
  const calls: string[] = []
  const adapter: AdminActivityAdapter = {
    organizationList: async (_realm, org) => {
      calls.push(org)
      return createResultError("list", "denied")
    },
    realmList: async () => {
      calls.push("realm")
      return createResult({ items: [] })
    },
  }
  const scope = createRoot((dispose) => {
    const [organizationId, select] = createSignal<string | undefined>("A")
    return { dispose, select, state: adminActivityStateCreate({ adapter, realmId: () => "r", organizationId }) }
  })
  await flush()
  expect(scope.state.status()).toBe("error")
  expect(calls).toEqual(["A"])
  scope.select(undefined)
  await flush()
  expect(calls).toEqual(["A", "realm"])
  expect(scope.state.status()).toBe("empty")
  scope.dispose()
})

test("late organization A response cannot overwrite B", async () => {
  let resolveA!: (value: ReturnType<typeof createResult<EventListResponse>>) => void
  const adapter: AdminActivityAdapter = {
    organizationList: (_realm, org) =>
      org === "A"
        ? new Promise((resolve) => {
            resolveA = resolve
          })
        : Promise.resolve(createResult({ items: [], nextPageToken: "b" })),
    realmList: async () => createResult({ items: [] }),
  }
  const scope = createRoot((dispose) => {
    const [organizationId, select] = createSignal<string | undefined>("A")
    return { dispose, select, state: adminActivityStateCreate({ adapter, realmId: () => "r", organizationId }) }
  })
  scope.select("B")
  await flush()
  resolveA(createResult({ items: [] }))
  await flush()
  expect(scope.state.hasNextPage()).toBe(true)
  scope.dispose()
})

test("pagination goes forward and backward and retry repeats the failed page", async () => {
  const calls: (string | undefined)[] = []
  let fail = true
  const adapter: AdminActivityAdapter = {
    organizationList: async (_realm, _org, query) => {
      calls.push(query.pageToken)
      if (query.pageToken && fail) {
        fail = false
        return createResultError("list", "temporary")
      }
      return createResult({ items: [], nextPageToken: query.pageToken ? undefined : "next" })
    },
    realmList: async () => createResult({ items: [] }),
  }
  const scope = createRoot((dispose) => ({
    dispose,
    state: adminActivityStateCreate({ adapter, realmId: () => "r", organizationId: () => "A" }),
  }))
  await flush()
  scope.state.pageNext()
  await flush()
  expect(scope.state.status()).toBe("error")
  scope.state.retry()
  await flush()
  expect(scope.state.hasPreviousPage()).toBe(true)
  scope.state.pagePrevious()
  await flush()
  expect(calls).toEqual([undefined, "next", "next", undefined])
  scope.dispose()
})
