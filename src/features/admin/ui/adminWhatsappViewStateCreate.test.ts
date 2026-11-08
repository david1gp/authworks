import { describe, expect, mock, test } from "bun:test"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import type { WhatsappOtpUsageQuery } from "../../whatsappOtp/public/whatsappOtpUsageQuerySchema.js"
import type { WhatsappOtpUsageResponse } from "../../whatsappOtp/public/whatsappOtpUsageResponseSchema.js"
import { adminDemoAdapterCreate } from "./adminDemoAdapterCreate.js"
import { adminDemoWhatsappUsageFixture } from "./adminDemoWhatsappUsageFixture.js"

// Plain `bun test` resolves Solid's server runtime, whose effects do not run.
// Use the real client runtime so initial loads and reactive accessors are exercised.
const solidRuntimePath = "../../../../node_modules/solid-js/dist/solid.js"
const solidRuntime = await import(solidRuntimePath)
mock.module("solid-js", () => solidRuntime)
const [{ createRoot, createSignal }, { adminWhatsappViewStateCreate }, { adminPageStateCreate }] = await Promise.all([
  import("solid-js"),
  import("./adminWhatsappViewStateCreate.js"),
  import("./adminPageStateCreate.js"),
])

const flushLoads = async () => {
  for (let index = 0; index < 10; index += 1) await Promise.resolve()
}

describe("whatsapp usage view state", () => {
  test("derives request and delivery tiles from the usage response", () => {
    const state = adminWhatsappViewStateCreate({ usage: () => adminDemoWhatsappUsageFixture })
    expect(state.tiles().map((tile) => tile.value)).toEqual([9, 87, 21, 105, 2, 4])
    expect(state.tiles().every((tile) => tile.label.length > 0)).toBe(true)
  })

  test("renders quota fills from sent over limit and clamps the range", () => {
    const state = adminWhatsappViewStateCreate({ usage: () => adminDemoWhatsappUsageFixture })
    const [nearLimit, unhealthy, idle] = state.senderCards()
    expect(nearLimit?.hour.percent).toBe(90)
    expect(nearLimit?.hour.width).toBe("90%")
    expect(nearLimit?.hour.line).toBe("18 sent · 2 left of 20")
    expect(nearLimit?.day.percent).toBe(64)
    expect(unhealthy?.healthTone).toBe("danger")
    expect(unhealthy?.healthLabel).toBe("Unhealthy")
    expect(unhealthy?.dimmed).toBe(true)
    expect(idle?.dimmed).toBe(false)
    expect(idle?.hour.percent).toBe(0)
  })

  test("renders a full bar when the configured limit is zero", () => {
    const zeroLimit: WhatsappOtpUsageResponse = {
      ...adminDemoWhatsappUsageFixture,
      limits: { dailyPerSender: 0, hourlyPerSender: 0 },
    }
    const state = adminWhatsappViewStateCreate({ usage: () => zeroLimit })
    expect(state.senderCards()[0]?.hour.percent).toBe(100)
    expect(state.senderCards()[0]?.day.percent).toBe(100)
  })

  test("sorts purpose entries by count and keeps unknown purpose names as-is", () => {
    const state = adminWhatsappViewStateCreate({ usage: () => adminDemoWhatsappUsageFixture })
    expect(state.purposeEntries()).toEqual([
      { count: 72, name: "sign_in" },
      { count: 25, name: "registration" },
      { count: 8, name: "account_phone_change" },
    ])
  })

  test("reports the tightest remaining daily quota and hides the hint without senders", () => {
    const state = adminWhatsappViewStateCreate({ usage: () => adminDemoWhatsappUsageFixture })
    expect(state.tightestRemaining()).toBe(36)
    expect(state.remainingHint()).toBe("36 sends left on the tightest sender")
    const empty = adminWhatsappViewStateCreate({ usage: () => undefined })
    expect(empty.tightestRemaining()).toBeUndefined()
    expect(empty.remainingHint()).toBeUndefined()
  })

  test("labels recent delivery statuses with the matching tone", () => {
    const state = adminWhatsappViewStateCreate({ usage: () => undefined })
    expect(state.recentStatusGet("sent")).toEqual({ label: "Sent", tone: "success" })
    expect(state.recentStatusGet("failed")).toEqual({ label: "Failed", tone: "danger" })
    expect(state.recentStatusGet("blocked")).toEqual({ label: "Blocked", tone: "warning" })
  })

  test("derives phone and code cells from the recent rows", () => {
    const state = adminWhatsappViewStateCreate({ usage: () => adminDemoWhatsappUsageFixture })
    expect(state.recentRows().map((row) => row.phone)).toEqual([
      "+491700000001",
      "+491700000002",
      "+491700000003",
      "+491700000004",
      "+491700000005",
      "+491700000006",
      "+491700000007",
    ])
    expect(state.recentRows().map((row) => row.code)).toEqual([
      "4***2",
      "9***1",
      "2***8",
      "7***3",
      "5***9",
      "1***6",
      "8***4",
    ])
  })

  test("falls back to the hash prefix and the em-dash for pre-Phase-2 rows", () => {
    const legacy: WhatsappOtpUsageResponse = {
      ...adminDemoWhatsappUsageFixture,
      recent: [
        {
          code: null,
          createdAt: adminDemoWhatsappUsageFixture.recent[0]?.createdAt ?? 0,
          endpointId: "primary",
          purpose: "sign_in",
          realmId: null,
          recipientHashPrefix: "a3f9c2e1",
          recipientPhone: null,
          sessionName: null,
          status: "sent",
        },
      ],
    }
    const state = adminWhatsappViewStateCreate({ usage: () => legacy })
    expect(state.recentRows()).toHaveLength(1)
    expect(state.recentRows()[0]?.phone).toBe("a3f9c2e1")
    expect(state.recentRows()[0]?.code).toBe("—")
  })

  test("marks the active window option and defaults to 24h", () => {
    const day = adminWhatsappViewStateCreate({ usage: () => undefined, window: () => "24h" })
    expect(day.windowOptions()).toEqual([
      { label: "Last 24 hours", value: "24h" },
      { label: "Last 3 days", value: "3d" },
      { label: "Last 7 days", value: "7d" },
    ])
    expect(day.windowSelected("24h")).toBe(true)
    expect(day.windowSelected("3d")).toBe(false)
    const week = adminWhatsappViewStateCreate({ usage: () => undefined, window: () => "7d" })
    expect(week.windowOptions().map((option) => option.value)).toEqual(["24h", "3d", "7d"])
    expect(week.windowSelected("7d")).toBe(true)
    expect(week.windowSelected("24h")).toBe(false)
    const fallback = adminWhatsappViewStateCreate({ usage: () => undefined })
    expect(fallback.windowSelected("24h")).toBe(true)
    expect(fallback.windowSelected("7d")).toBe(false)
  })

  test("keeps window option identities stable when the recent window changes", () => {
    const [window, setWindow] = createSignal<WhatsappOtpUsageQuery["window"]>("24h")
    const state = adminWhatsappViewStateCreate({ usage: () => undefined, window })
    const before = state.windowOptions()
    expect(state.windowSelected("24h")).toBe(true)
    setWindow("7d")
    const after = state.windowOptions()
    expect(after).toHaveLength(before.length)
    expect(after.map((option, index) => option === before[index])).toEqual([true, true, true])
    expect(state.windowSelected("7d")).toBe(true)
    expect(state.windowSelected("24h")).toBe(false)
  })
})

describe("whatsapp usage page state", () => {
  test.each([
    ["success", "ready"],
    ["empty", "empty"],
    ["loading", "loading"],
    ["error", "error"],
    ["expired", "expired"],
  ] as const)("loads the %s demo usage as %s", async (fixtureState, expectedStatus) => {
    const adapter = adminDemoAdapterCreate((): DemoFixtureState => fixtureState)
    const { dispose, page } = createRoot((dispose) => ({
      dispose,
      page: adminPageStateCreate({ adapter, confirm: () => false, screen: () => "whatsapp" }),
    }))
    await flushLoads()
    expect(page.status()).toBe(expectedStatus)
    if (fixtureState === "success") {
      // The adapter rebases fixture timestamps onto now and the default 24h window keeps the
      // five recent rows; totals, tiles, and sender cards stay fixture constants.
      expect(page.whatsappWindow()).toBe("24h")
      expect(page.whatsappUsage()).toMatchObject({
        attempts: adminDemoWhatsappUsageFixture.attempts,
        limits: adminDemoWhatsappUsageFixture.limits,
        senders: adminDemoWhatsappUsageFixture.senders,
        totals: adminDemoWhatsappUsageFixture.totals,
      })
      const recent = page.whatsappUsage()?.recent ?? []
      expect(recent).toHaveLength(5)
      expect(recent.map((row) => row.status)).toEqual(["sent", "failed", "sent", "blocked", "sent"])
      expect(recent.map((row) => row.recipientPhone)).toEqual([
        "+491700000001",
        "+491700000002",
        "+491700000003",
        "+491700000004",
        "+491700000005",
      ])
      // Rebased rows land inside the default window, anchored with the newest row at now.
      for (const row of recent) {
        expect(row.createdAt).toBeLessThanOrEqual(Date.now())
        expect(row.createdAt).toBeGreaterThan(Date.now() - 24 * 3_600_000)
      }
      // Rebasing preserves the fixture's relative spacing between rows.
      expect((recent[0]?.createdAt ?? 0) - (recent[1]?.createdAt ?? 0)).toBe(
        (adminDemoWhatsappUsageFixture.recent[0]?.createdAt ?? 0) -
          (adminDemoWhatsappUsageFixture.recent[1]?.createdAt ?? 0),
      )
    }
    if (fixtureState === "empty") {
      expect(page.whatsappUsage()?.senders).toEqual([])
      expect(page.whatsappUsage()?.recent).toEqual([])
    }
    if (fixtureState === "loading" || fixtureState === "error" || fixtureState === "expired")
      expect(page.whatsappUsage()).toBeUndefined()
    dispose()
  })

  test("loads usage alongside the realm dashboard and tolerates its absence", async () => {
    const adapter = adminDemoAdapterCreate((): DemoFixtureState => "success", { signedInInitially: true })
    const { dispose, page } = createRoot((dispose) => ({
      dispose,
      page: adminPageStateCreate({ adapter, confirm: () => false, screen: () => "realm" }),
    }))
    await flushLoads()
    expect(page.status()).toBe("ready")
    expect(page.whatsappUsage()?.totals.sentLastDay).toBe(105)
    dispose()
  })
})

describe("whatsapp usage window", () => {
  test.each([
    ["", "24h", 5],
    ["?window=24h", "24h", 5],
    ["?window=3d", "3d", 6],
    ["?window=7d", "7d", 7],
    ["?window=bogus", "24h", 5],
  ] as const)("search %s loads window %s with %s rows", async (search, expectedWindow, expectedRows) => {
    const adapter = adminDemoAdapterCreate((): DemoFixtureState => "success")
    const { dispose, page } = createRoot((dispose) => ({
      dispose,
      page: adminPageStateCreate({
        adapter,
        confirm: () => false,
        screen: () => "whatsapp",
        whatsappWindowSearch: () => search,
      }),
    }))
    await flushLoads()
    expect(page.whatsappWindow()).toBe(expectedWindow)
    expect(page.whatsappUsage()?.recent).toHaveLength(expectedRows)
    dispose()
  })

  test("a changed URL search refetches with the wider window", async () => {
    const adapter = adminDemoAdapterCreate((): DemoFixtureState => "success")
    const [search, setSearch] = createSignal("")
    const { dispose, page } = createRoot((dispose) => ({
      dispose,
      page: adminPageStateCreate({
        adapter,
        confirm: () => false,
        screen: () => "whatsapp",
        whatsappWindowSearch: search,
      }),
    }))
    await flushLoads()
    expect(page.whatsappUsage()?.recent).toHaveLength(5)
    setSearch("?window=7d")
    await flushLoads()
    expect(page.whatsappWindow()).toBe("7d")
    expect(page.whatsappUsage()?.recent).toHaveLength(7)
    dispose()
  })

  test("selecting a window refetches usage and holds it in the URL", async () => {
    const replaced: string[] = []
    const windowStub = {
      location: new URL("http://localhost/demo/admin/whatsapp"),
      history: {
        replaceState: (_state: unknown, _unused: string, url: string) => {
          replaced.push(url)
        },
      },
    }
    ;(globalThis as { window?: unknown }).window = windowStub
    try {
      const adapter = adminDemoAdapterCreate((): DemoFixtureState => "success")
      const { dispose, page } = createRoot((dispose) => ({
        dispose,
        page: adminPageStateCreate({ adapter, confirm: () => false, screen: () => "whatsapp" }),
      }))
      await flushLoads()
      expect(page.whatsappUsage()?.recent).toHaveLength(5)
      page.whatsappWindowSet("7d")
      await flushLoads()
      expect(page.whatsappWindow()).toBe("7d")
      expect(page.whatsappUsage()?.recent).toHaveLength(7)
      // The debounced URL write lands after the refetch; the param survives reloads.
      await new Promise((resolve) => setTimeout(resolve, 350))
      expect(replaced.at(-1)).toContain("window=7d")
      dispose()
    } finally {
      delete (globalThis as { window?: unknown }).window
    }
  })
})
