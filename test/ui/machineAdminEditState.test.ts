import { describe, expect, mock, test } from "bun:test"

mock.module("solid-js", () => ({
  createEffect: (fn: () => void) => fn(),
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (_dependencies: unknown, fn: () => void) => fn,
}))

const [
  { machineAdminPageStateCreate },
  { machineAdminEditFormStateCreate },
  { resultCreate },
  { resultErrorCodedCreate },
] = await Promise.all([
  import("../../src/features/machineUsers/ui/machineAdminPageStateCreate.js"),
  import("../../src/features/machineUsers/ui/machineAdminEditFormStateCreate.js"),
  import("../../src/platform/errors/resultCreate.js"),
  import("../../src/platform/errors/resultErrorCodedCreate.js"),
])

const machineUserId = "01900000-0000-7000-8000-000000000021"

function machineUserCreate(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: 1_755_782_400_000,
    displayName: "Build worker",
    id: machineUserId,
    realmId: "01900000-0000-7000-8000-000000000001",
    scopes: ["event.read"],
    status: "active" as const,
    updatedAt: 1_755_782_400_000,
    userName: "build-worker",
    ...overrides,
  }
}

function pageStateCreate(options: { update: (input: unknown) => Promise<unknown> }) {
  const calls: { args: unknown[]; name: string }[] = []
  const machineUser = machineUserCreate()
  const adapter = {
    apiKeyCreate: async () => resultErrorCodedCreate("test", "unused", "test.unused"),
    clientSecretRotate: async () => resultErrorCodedCreate("test", "unused", "test.unused"),
    credentialList: async () => resultCreate({ items: [] }),
    credentialRevoke: async () => resultErrorCodedCreate("test", "unused", "test.unused"),
    machineUserCreate: async () => resultErrorCodedCreate("test", "unused", "test.unused"),
    machineUserGet: async () => resultCreate(machineUserCreate()),
    machineUserLifecycleSet: async () => resultErrorCodedCreate("test", "unused", "test.unused"),
    machineUserList: async () => resultCreate({ items: [] }),
    machineUserUpdate: async (_id: string, input: unknown) => {
      calls.push({ args: [_id, input], name: "machineUserUpdate" })
      return options.update(input)
    },
    personalAccessTokenCreate: async () => resultErrorCodedCreate("test", "unused", "test.unused"),
  }
  const state = machineAdminPageStateCreate({
    adapter: adapter as never,
    confirm: async () => true,
    machineUserId: () => machineUserId,
    now: () => 1_755_782_400_000,
    screen: () => "machine-user-detail" as const,
  })
  return { adapter, calls, machineUser, state }
}

const tick = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("machine user update page state", () => {
  test("saves the edit payload and refreshes the machine user with a notice", async () => {
    const updated = machineUserCreate({ displayName: "New name", scopes: ["event.read", "user.read"] })
    const { calls, state } = pageStateCreate({
      update: async () => resultCreate(updated),
    })
    await tick()
    const failure = await state.machineUserUpdate(machineUserId, {
      displayName: "New name",
      scopes: ["event.read", "user.read"],
    })
    expect(failure).toBeUndefined()
    expect(calls).toEqual([
      {
        args: [machineUserId, { displayName: "New name", scopes: ["event.read", "user.read"] }],
        name: "machineUserUpdate",
      },
    ])
    expect(state.machineUser()).toEqual(updated)
    expect(state.notice()).toBe("machine-user-updated")
  })

  test("surfaces an invalid scope error without replacing the machine user", async () => {
    const { state } = pageStateCreate({
      update: async () =>
        resultErrorCodedCreate(
          "machineUserUpdate",
          "The requested machine scopes are invalid.",
          "machine-users.invalid-scope",
        ),
    })
    await tick()
    const before = state.machineUser()
    const failure = await state.machineUserUpdate(machineUserId, { displayName: "New name", scopes: ["nope"] })
    expect(failure).toContain("scopes")
    expect(state.machineUser()).toEqual(before)
  })
})

describe("machine user edit form state", () => {
  test("rejects an empty display name before touching the adapter", async () => {
    const updates: unknown[] = []
    const { state } = pageStateCreate({
      update: async (input) => {
        updates.push(input)
        return resultCreate(machineUserCreate())
      },
    })
    await tick()
    const saved: string[] = []
    const form = machineAdminEditFormStateCreate({
      machineUserId: () => machineUserId,
      onSaved: () => saved.push("saved"),
      page: state,
    })
    form.displayName.set("   ")
    await form.submit({ preventDefault: () => undefined } as SubmitEvent)
    expect(updates).toHaveLength(0)
    expect(form.formError()).toContain("display name")
    expect(saved).toHaveLength(0)
  })

  test("submits parsed scopes and closes on success", async () => {
    const updates: unknown[] = []
    const { state } = pageStateCreate({
      update: async (input) => {
        updates.push(input)
        return resultCreate(machineUserCreate())
      },
    })
    await tick()
    const saved: string[] = []
    const form = machineAdminEditFormStateCreate({
      machineUserId: () => machineUserId,
      onSaved: () => saved.push("saved"),
      page: state,
    })
    form.displayName.set("  New name  ")
    form.scopes.set("event.read, user.read event.read")
    await form.submit({ preventDefault: () => undefined } as SubmitEvent)
    expect(updates).toEqual([{ displayName: "New name", scopes: ["event.read", "user.read"] }])
    expect(form.formError()).toBeUndefined()
    expect(saved).toEqual(["saved"])
  })

  test("keeps the dialog open and shows the adapter error on failure", async () => {
    const { state } = pageStateCreate({
      update: async () =>
        resultErrorCodedCreate(
          "machineUserUpdate",
          "The requested machine scopes are invalid.",
          "machine-users.invalid-scope",
        ),
    })
    await tick()
    const saved: string[] = []
    const form = machineAdminEditFormStateCreate({
      machineUserId: () => machineUserId,
      onSaved: () => saved.push("saved"),
      page: state,
    })
    form.displayName.set("New name")
    form.scopes.set("nope")
    await form.submit({ preventDefault: () => undefined } as SubmitEvent)
    expect(form.formError()).toContain("scopes")
    expect(saved).toHaveLength(0)
  })
})
