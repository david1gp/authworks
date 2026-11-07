import { describe, expect, mock, test } from "bun:test"
import type { DemoFixtureState } from "../../demo/demoFixtureStateSchema.js"
import type { WhatsappOtpUsageResponse } from "../../whatsappOtp/public/whatsappOtpUsageResponseSchema.js"
import { adminDemoAdapterCreate } from "./adminDemoAdapterCreate.js"
import { adminDemoWhatsappUsageFixture } from "./adminDemoWhatsappUsageFixture.js"

// Plain `bun test` resolves Solid's server runtime, whose effects do not run.
// Use the real client runtime so initial loads and reactive accessors are exercised.
const solidRuntimePath = "../../../../node_modules/solid-js/dist/solid.js"
const solidRuntime = await import(solidRuntimePath)
mock.module("solid-js", () => solidRuntime)
const [{ createRoot }, { adminWhatsappViewStateCreate }, { adminPageStateCreate }] = await Promise.all([
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
    if (fixtureState === "success") expect(page.whatsappUsage()).toEqual(adminDemoWhatsappUsageFixture)
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
