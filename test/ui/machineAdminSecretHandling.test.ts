import { describe, expect, mock, test } from "bun:test"

mock.module("solid-js", () => ({
  createEffect: (fn: () => void) => fn(),
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (_deps: unknown, fn: () => void) => fn,
}))

const [{ machineAdminSecretPanelStateCreate }, { machineAdminDemoIssuedSecretSeedSelect }, { demoAdminMachineUsers }] =
  await Promise.all([
    import("../../src/features/machineUsers/ui/machineAdminSecretPanelStateCreate.js"),
    import("../../src/features/machineUsers/ui/machineAdminDemoIssuedSecretSeedSelect.js"),
    import("../../src/features/demo/demoAdminMachineUsers.js"),
  ])

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

describe("one-time demo secret seeding", () => {
  test("seeds the selected machine user rather than always the first user", () => {
    const second = demoAdminMachineUsers[1]
    if (second === undefined) throw new Error("fixture is missing a second machine user")

    const seeded = machineAdminDemoIssuedSecretSeedSelect({
      machineUserId: second.id,
      machineUsers: demoAdminMachineUsers,
      secret: "demo-secret",
    })

    expect(seeded?.machineUserId).toBe(second.id)
    expect(seeded?.machineUserName).toBe(second.displayName)
    expect(seeded?.clientId).toBe(second.userName)
  })

  test("seeds the first machine user only for a collection screen without a selection", () => {
    const seeded = machineAdminDemoIssuedSecretSeedSelect({
      machineUserId: undefined,
      machineUsers: demoAdminMachineUsers,
      secret: "demo-secret",
    })

    expect(seeded?.machineUserId).toBe(demoAdminMachineUsers[0]?.id)
  })

  test("seeds nothing for an unknown machine user so no foreign identity is shown", () => {
    expect(
      machineAdminDemoIssuedSecretSeedSelect({
        machineUserId: "missing",
        machineUsers: demoAdminMachineUsers,
        secret: "demo-secret",
      }),
    ).toBeUndefined()
  })
})
