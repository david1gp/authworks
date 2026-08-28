import { beforeEach, describe, expect, mock, test } from "bun:test"

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
      const run = () => {
        currentObserver = run
        deps()
        currentObserver = null
        fn()
      }
      run()
    }
  },
}))

const [{ machineAdminDemoAdapterCreate }, { machineAdminDemoRecordStore }, { machineAdminPageStateCreate }] =
  await Promise.all([
    import("../../src/features/machineUsers/ui/machineAdminDemoAdapterCreate.js"),
    import("../../src/features/machineUsers/ui/machineAdminDemoRecordStore.js"),
    import("../../src/features/machineUsers/ui/machineAdminPageStateCreate.js"),
  ])

const billingSyncId = "01900000-0000-7000-8000-000000000071"
const demoNow = 1_755_782_400_000

/** A tracked signal, so a change actually re-runs the page state's reload effect. */
function reactiveSignalCreate<T>(initial: T) {
  let value = initial
  const subscribers = new Set<() => void>()
  const get = () => {
    if (currentObserver !== null) subscribers.add(currentObserver)
    return value
  }
  const set = (next: T) => {
    value = next
    for (const subscriber of [...subscribers]) subscriber()
  }
  return [get, set] as const
}

// Every case starts from the authored fixtures so the shared demo records stay deterministic.
beforeEach(() => machineAdminDemoRecordStore.reset())

describe("demo machine-user records across adapter instances", () => {
  test("a created machine user is resolvable by the adapter its detail route mounts", async () => {
    const directoryAdapter = machineAdminDemoAdapterCreate(() => "success")

    const created = await directoryAdapter.machineUserCreate({
      displayName: "Routed Service",
      userName: "routed-service",
    })
    if (!created.success) throw new Error("the demo fixture failed to create a machine user")

    // Navigating to the generated detail route builds a fresh adapter, which previously reset
    // to the static fixtures and failed the lookup with the generic error state.
    const detailAdapter = machineAdminDemoAdapterCreate(() => "success")
    const read = await detailAdapter.machineUserGet(created.data.machineUser.id)

    expect(read.success && read.data.displayName).toBe("Routed Service")
    expect(read.success && read.data.userName).toBe("routed-service")
  })

  test("a credential issued on one screen is listed by the adapter of the next screen", async () => {
    const issuingAdapter = machineAdminDemoAdapterCreate(() => "success")

    const issued = await issuingAdapter.apiKeyCreate(billingSyncId, {
      machineUserId: billingSyncId,
      name: "Carried Key",
    })
    if (!issued.success) throw new Error("the demo fixture failed to issue a credential")

    const listed = await machineAdminDemoAdapterCreate(() => "success").credentialList(billingSyncId)

    expect(listed.success && listed.data.items.some((item) => item.id === issued.data.credential.id)).toBe(true)
  })

  test("resetting restores the authored fixtures for adapters that already exist", async () => {
    const adapter = machineAdminDemoAdapterCreate(() => "success")
    const before = await adapter.machineUserList()
    await adapter.machineUserCreate({ displayName: "Temporary", userName: "temporary" })

    machineAdminDemoRecordStore.reset()
    const after = await adapter.machineUserList()

    expect(after.success && before.success && after.data.items.length).toBe(
      before.success ? before.data.items.length : 0,
    )
    expect(after.success && after.data.items.some((item) => item.userName === "temporary")).toBe(false)
  })
})

describe("one-time secret retention across URL-only changes", () => {
  test("closing the issue dialog keeps the issued secret usable", async () => {
    const [search, searchSet] = reactiveSignalCreate("?dialog=credential")
    const page = machineAdminPageStateCreate({
      adapter: machineAdminDemoAdapterCreate(() => "success"),
      confirm: () => true,
      machineUserId: () => billingSyncId,
      now: () => demoNow,
      // The demo reload key is the fixture state, which a dialog or search edit leaves unchanged.
      // Reading the location anyway reproduces the real dependency: the effect re-runs on any URL
      // change even though every value it keys on is identical.
      reloadKey: () => {
        search()
        return "success"
      },
      screen: () => "machine-credentials",
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    const issued = await page.apiKeyCreate(billingSyncId, { name: "Overview Token" })
    expect(issued).toBe(true)
    expect(page.issuedSecret()?.secret).toBeString()

    // Closing the dialog only rewrites the URL; the one-time value must survive it.
    searchSet("")
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(page.issuedSecret()?.kind).toBe("api_key")
    expect(page.issuedSecret()?.secret).toStartWith("demo-secret-")
  })

  test("acknowledgement still clears the secret so it is shown exactly once", async () => {
    const page = machineAdminPageStateCreate({
      adapter: machineAdminDemoAdapterCreate(() => "success"),
      confirm: () => true,
      machineUserId: () => billingSyncId,
      now: () => demoNow,
      screen: () => "machine-credentials",
    })

    await new Promise((resolve) => setTimeout(resolve, 10))
    await page.personalAccessTokenCreate(billingSyncId, { name: "Once Only" })
    expect(page.issuedSecret()).toBeDefined()

    page.issuedSecretAcknowledge()

    expect(page.issuedSecret()).toBeUndefined()
  })

  test("changing the selected machine user does discard an unacknowledged secret", async () => {
    const [machineUserId, machineUserIdSet] = reactiveSignalCreate(billingSyncId)
    const page = machineAdminPageStateCreate({
      adapter: machineAdminDemoAdapterCreate(() => "success"),
      confirm: () => true,
      machineUserId,
      now: () => demoNow,
      screen: () => "machine-credentials",
    })

    await new Promise((resolve) => setTimeout(resolve, 10))
    await page.apiKeyCreate(billingSyncId, { name: "Subject Bound" })
    expect(page.issuedSecret()).toBeDefined()

    // A different subject is a real reload, so the previous subject's value must not linger.
    machineUserIdSet("01900000-0000-7000-8000-000000000072")
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(page.issuedSecret()).toBeUndefined()
  })
})
