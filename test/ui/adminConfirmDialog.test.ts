import { describe, expect, mock, test } from "bun:test"

// The Solid runtime is not resolvable under the test condition, so the primitives the
// administration state creators use are replaced with equivalent non-reactive behaviour.
mock.module("solid-js", () => ({
  createEffect: (effect: (previous?: unknown) => unknown) => effect(),
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (dependency: () => unknown, handler: (value: unknown) => unknown) => () => handler(dependency()),
}))

const [
  { confirmStateCreate: adminConfirmStateCreate },
  { adminPageStateCreate },
  { adminDemoAdapterCreate },
  { impersonationAdminPageStateCreate },
  { impersonationAdminDemoAdapterCreate },
  { demoAdminImpersonationNow },
  { englishCatalog },
] = await Promise.all([
  import("../../src/ui/confirm/confirmStateCreate.js"),
  import("../../src/features/admin/ui/adminPageStateCreate.js"),
  import("../../src/features/admin/ui/adminDemoAdapterCreate.js"),
  import("../../src/features/impersonation/ui/impersonationAdminPageStateCreate.js"),
  import("../../src/features/impersonation/ui/impersonationAdminDemoAdapterCreate.js"),
  import("../../src/features/demo/demoAdminImpersonationNow.js"),
  import("../../src/ui/i18n/model/englishCatalog.js"),
])

const adminPageCreate = (confirmState: ReturnType<typeof adminConfirmStateCreate>, screen: "realm") =>
  adminPageStateCreate({
    adapter: adminDemoAdapterCreate(() => "success", { signedInInitially: true }),
    confirm: confirmState.confirm,
    screen: () => screen,
  })

describe("administration confirmation dialog", () => {
  test("carries a translated title alongside the shared cancel and continue labels", () => {
    expect(englishCatalog["admin.common.confirmTitle"]).toBeString()
    expect(englishCatalog["common.cancel"]).toBeString()
    expect(englishCatalog["common.continue"]).toBeString()
  })
})

describe("realm disabling through the confirmation dialog", () => {
  const submit = { preventDefault: () => undefined } as SubmitEvent
  test("cancelling keeps the realm active", async () => {
    const confirmState = adminConfirmStateCreate()
    const page = adminPageCreate(confirmState, "realm")
    await Promise.resolve()
    await Promise.resolve()
    page.realmStatus.set("disabled")

    const pending = page.realmSave(submit)
    await Promise.resolve()
    expect(confirmState.open()).toBe(true)
    confirmState.cancel()
    await pending

    expect(confirmState.open()).toBe(false)
    expect(page.realm()?.status).not.toBe("disabled")
  })

  test("confirming disables the realm and narrates the outcome", async () => {
    const confirmState = adminConfirmStateCreate()
    const page = adminPageCreate(confirmState, "realm")
    await Promise.resolve()
    await Promise.resolve()
    page.realmStatus.set("disabled")

    const pending = page.realmSave(submit)
    await Promise.resolve()
    confirmState.accept()
    await pending

    expect(confirmState.open()).toBe(false)
    expect(page.realm()?.status).toBe("disabled")
    expect(page.notice()).toBeString()
  })
})

describe("impersonation end through the confirmation dialog", () => {
  const impersonationPageCreate = (confirmState: ReturnType<typeof adminConfirmStateCreate>) =>
    impersonationAdminPageStateCreate({
      adapter: impersonationAdminDemoAdapterCreate(() => "active"),
      confirm: confirmState.confirm,
      now: () => demoAdminImpersonationNow,
    })

  test("cancelling keeps the impersonation session active", async () => {
    const confirmState = adminConfirmStateCreate()
    const page = impersonationPageCreate(confirmState)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    const pending = page.impersonationEnd()
    await Promise.resolve()
    expect(confirmState.open()).toBe(true)
    confirmState.cancel()
    await pending

    expect(confirmState.open()).toBe(false)
    expect(page.active()).not.toBeNull()
    expect(page.notice()).toBeUndefined()
  })

  test("confirming ends the impersonation session", async () => {
    const confirmState = adminConfirmStateCreate()
    const page = impersonationPageCreate(confirmState)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    const pending = page.impersonationEnd()
    await Promise.resolve()
    confirmState.accept()
    await pending

    expect(page.active()).toBeNull()
    expect(page.notice()).toBe(englishCatalog["admin.impersonation.endedNotice"])
  })
})

describe("superseded confirmations", () => {
  test("a new prompt declines the previous one so no caller waits forever", async () => {
    const confirmState = adminConfirmStateCreate()
    const first = confirmState.confirm("first")
    const second = confirmState.confirm("second")

    expect(await first).toBe(false)
    expect(confirmState.message()).toBe("second")
    confirmState.accept()
    expect(await second).toBe(true)
  })
})
