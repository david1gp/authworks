import { describe, expect, mock, test } from "bun:test"

mock.module("solid-js", () => ({
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
}))

const { machineAdminSecretPanelStateCreate } = await import(
  "../../src/features/machineUsers/ui/machineAdminSecretPanelStateCreate.js"
)

describe("one-time machine credential panel", () => {
  test("requires a copy before acknowledgement is offered", async () => {
    const state = machineAdminSecretPanelStateCreate({
      onAcknowledge: () => undefined,
      secret: () => "machine-top-secret",
      writeText: async () => undefined,
    })

    expect(state.copied()).toBe(false)
    state.copy()
    await Promise.resolve()
    expect(state.copied()).toBe(true)
    expect(state.copyFailed()).toBe(false)
  })

  test("reports a denied clipboard instead of trapping the value", async () => {
    const state = machineAdminSecretPanelStateCreate({
      onAcknowledge: () => undefined,
      secret: () => "machine-top-secret",
      writeText: async () => {
        throw new Error("denied")
      },
    })

    state.copy()
    await Promise.resolve()
    await Promise.resolve()
    expect(state.copyFailed()).toBe(true)
    expect(state.copied()).toBe(false)
  })

  test("copies the exact secret verbatim and acknowledges exactly once", async () => {
    const written: string[] = []
    let acknowledged = 0
    const state = machineAdminSecretPanelStateCreate({
      onAcknowledge: () => {
        acknowledged += 1
      },
      secret: () => "exact-machine-secret-value",
      writeText: async (value) => {
        written.push(value)
      },
    })

    state.copy()
    await Promise.resolve()
    state.acknowledge()

    expect(written).toEqual(["exact-machine-secret-value"])
    expect(acknowledged).toBe(1)
    expect(state.copied()).toBe(false)
  })

  test("copies nothing when no secret is present", async () => {
    const written: string[] = []
    const state = machineAdminSecretPanelStateCreate({
      onAcknowledge: () => undefined,
      secret: () => undefined,
      writeText: async (value) => {
        written.push(value)
      },
    })

    state.copy()
    await Promise.resolve()

    expect(written).toEqual([])
    expect(state.copied()).toBe(false)
  })
})
