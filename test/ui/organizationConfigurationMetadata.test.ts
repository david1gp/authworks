import { describe, expect, mock, test } from "bun:test"

let currentObserver: (() => void) | null = null

mock.module("solid-js", () => ({
  createEffect: (fn: () => void) => {
    fn()
  },
  createSignal: <T>(initial: T) => {
    let value = initial
    const subscribers = new Set<() => void>()
    const get = () => {
      if (currentObserver !== null) subscribers.add(currentObserver)
      return value
    }
    const set = (next: T | ((prev: T) => T)) => {
      value = typeof next === "function" ? (next as (prev: T) => T)(value) : next
      for (const subscriber of [...subscribers]) subscriber()
      return value
    }
    return [get, set] as const
  },
  on: (deps: () => unknown, fn: () => void) => {
    return () => {
      let previousKey: unknown = Symbol("initial")
      const checkAndRun = () => {
        currentObserver = checkAndRun
        const currentKey = deps()
        currentObserver = null
        if (currentKey !== previousKey) {
          previousKey = currentKey
          fn()
        }
      }
      checkAndRun()
    }
  },
}))

const { organizationAdminDemoAdapterCreate } = await import(
  "../../src/features/organizations/ui/organizationAdminDemoAdapterCreate.js"
)
const { organizationAdminPageStateCreate } = await import(
  "../../src/features/organizations/ui/organizationAdminPageStateCreate.js"
)
const { organizationAdminFormStateCreate } = await import(
  "../../src/features/organizations/ui/organizationAdminFormStateCreate.js"
)

const organizationId = "01900000-0000-7000-8000-000000000011"

describe("organization administration metadata demo adapter", () => {
  test("sets, lists, and removes metadata entries", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")

    const saved = await adapter.metadataSet(organizationId, "team", { value: "platform" })
    expect(saved.success && saved.data.metadata.value).toBe("platform")
    expect(saved.success && saved.data.metadata.version).toBe(1)

    const relisted = await adapter.metadataList(organizationId)
    expect(relisted.success && relisted.data.items.map((item) => item.key)).toEqual(["team"])

    const updated = await adapter.metadataSet(organizationId, "team", { value: "core" })
    expect(updated.success && updated.data.metadata.value).toBe("core")
    expect(updated.success && updated.data.metadata.version).toBe(2)

    const removed = await adapter.metadataRemove(organizationId, "team")
    expect(removed.success).toBe(true)
    const empty = await adapter.metadataList(organizationId)
    expect(empty.success && empty.data.items).toEqual([])
  })

  test("enforces the 50-entry cap for new keys only", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")

    for (let index = 0; index < 50; index += 1) {
      const saved = await adapter.metadataSet(organizationId, `key-${index}`, { value: "value" })
      expect(saved.success).toBe(true)
    }
    const over = await adapter.metadataSet(organizationId, "key-over", { value: "value" })
    expect(over.success).toBe(false)
    expect(over.success === false && over.code).toBe("organizations.metadata-limit")

    const refresh = await adapter.metadataSet(organizationId, "key-0", { value: "next" })
    expect(refresh.success && refresh.data.metadata.value).toBe("next")
  })

  test("isolates metadata entries per organization", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")
    await adapter.metadataSet(organizationId, "team", { value: "platform" })
    await adapter.metadataSet("other-organization", "team", { value: "other" })

    const list = await adapter.metadataList(organizationId)
    expect(list.success && list.data.items.map((item) => item.value)).toEqual(["platform"])
  })
})

describe("organization administration metadata page state", () => {
  test("sets and deletes metadata entries through the adapter", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")
    const calls: unknown[] = []
    const page = organizationAdminPageStateCreate({
      adapter: {
        ...adapter,
        metadataRemove: (id, key) => {
          calls.push(["remove", id, key])
          return adapter.metadataRemove(id, key)
        },
        metadataSet: (id, key, input) => {
          calls.push(["set", id, key, input])
          return adapter.metadataSet(id, key, input)
        },
      },
      confirm: () => true,
      organizationId: () => organizationId,
      screen: () => "configuration",
    })

    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(page.metadata()).toEqual([])

    expect(await page.metadataSet("team", "platform")).toBe(true)
    expect(calls[0]).toEqual(["set", organizationId, "team", { value: "platform" }])
    expect(page.metadata().map((item) => [item.key, item.value])).toEqual([["team", "platform"]])
    expect(page.notice()).toBe("metadata-saved")

    expect(await page.metadataSet("team", "core")).toBe(true)
    expect(page.metadata().map((item) => [item.key, item.value])).toEqual([["team", "core"]])

    await page.metadataRemove("team")
    expect(calls.at(-1)).toEqual(["remove", organizationId, "team"])
    expect(page.metadata()).toEqual([])
    expect(page.notice()).toBe("metadata-removed")
  })

  test("keeps the entry when the remove confirmation is declined", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "success")
    await adapter.metadataSet(organizationId, "team", { value: "platform" })
    const page = organizationAdminPageStateCreate({
      adapter,
      confirm: () => false,
      organizationId: () => organizationId,
      screen: () => "configuration",
    })

    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(page.metadata().map((item) => item.key)).toEqual(["team"])

    await page.metadataRemove("team")
    expect(page.metadata().map((item) => item.key)).toEqual(["team"])
  })

  test("surfaces adapter metadata failures as page errors", async () => {
    const adapter = organizationAdminDemoAdapterCreate(() => "permission-denied")
    const page = organizationAdminPageStateCreate({
      adapter,
      confirm: () => true,
      organizationId: () => organizationId,
      screen: () => "configuration",
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(await page.metadataSet("team", "platform")).toBe(false)
    expect(page.error()).toBe("You cannot manage this organization.")
  })

  test("validates the metadata form key and value", () => {
    const form = organizationAdminFormStateCreate()
    expect(form.validateMetadata()).toBe(false)

    form.metadataKey.set("team")
    expect(form.validateMetadata()).toBe(false)

    form.metadataValue.set("platform")
    expect(form.validateMetadata()).toBe(true)

    form.metadataKey.set("not valid!")
    expect(form.validateMetadata()).toBe(false)
  })
})
