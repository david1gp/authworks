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
  { confirmDialogFocusNextSelect: adminDialogFocusNextSelect },
  { adminPageStateCreate },
  { adminDemoAdapterCreate },
  { impersonationAdminPageStateCreate },
  { impersonationAdminDemoAdapterCreate },
  { demoAdminImpersonationNow },
  { englishCatalog },
] = await Promise.all([
  import("../../src/ui/confirm/confirmStateCreate.js"),
  import("../../src/ui/confirm/confirmDialogFocusNextSelect.js"),
  import("../../src/features/admin/ui/adminPageStateCreate.js"),
  import("../../src/features/admin/ui/adminDemoAdapterCreate.js"),
  import("../../src/features/impersonation/ui/impersonationAdminPageStateCreate.js"),
  import("../../src/features/impersonation/ui/impersonationAdminDemoAdapterCreate.js"),
  import("../../src/features/demo/demoAdminImpersonationNow.js"),
  import("../../src/ui/i18n/model/englishCatalog.js"),
])

const alexId = "01900000-0000-7000-8000-000000000021"
// The dialog renders cancel first so the destructive choice is never the default.
const dialogControls = ["cancel", "accept"] as const

const adminPageCreate = (confirmState: ReturnType<typeof adminConfirmStateCreate>, screen: "user-detail") =>
  adminPageStateCreate({
    adapter: adminDemoAdapterCreate(() => "success", { signedInInitially: true }),
    confirm: confirmState.confirm,
    screen: () => screen,
    userId: () => alexId,
  })

describe("administration confirmation dialog", () => {
  test("carries a translated title alongside the shared cancel and continue labels", () => {
    expect(englishCatalog["admin.common.confirmTitle"]).toBeString()
    expect(englishCatalog["common.cancel"]).toBeString()
    expect(englishCatalog["common.continue"]).toBeString()
  })

  test("keeps keyboard focus wrapping inside the dialog in both directions", () => {
    expect(adminDialogFocusNextSelect({ active: "cancel", backwards: false, elements: dialogControls })).toBe("accept")
    expect(adminDialogFocusNextSelect({ active: "accept", backwards: false, elements: dialogControls })).toBe("cancel")
    expect(adminDialogFocusNextSelect({ active: "accept", backwards: true, elements: dialogControls })).toBe("cancel")
    expect(adminDialogFocusNextSelect({ active: "page-button", backwards: false, elements: dialogControls })).toBe(
      "cancel",
    )
    expect(adminDialogFocusNextSelect({ active: undefined, backwards: false, elements: [] })).toBeUndefined()
  })
})

describe("user deletion through the confirmation dialog", () => {
  test("cancelling leaves the user untouched", async () => {
    const confirmState = adminConfirmStateCreate()
    const page = adminPageCreate(confirmState, "user-detail")
    await Promise.resolve()

    const pending = page.userDelete()
    await Promise.resolve()
    expect(confirmState.open()).toBe(true)
    expect(confirmState.message()).toContain("alex.morgan")
    confirmState.cancel()
    await pending

    expect(confirmState.open()).toBe(false)
    expect(page.status()).not.toBe("deleted")
    expect(page.notice()).toBeUndefined()
  })

  test("confirming deletes the user and narrates the outcome", async () => {
    const confirmState = adminConfirmStateCreate()
    const page = adminPageCreate(confirmState, "user-detail")
    await Promise.resolve()

    const pending = page.userDelete()
    await Promise.resolve()
    confirmState.accept()
    await pending

    expect(confirmState.open()).toBe(false)
    expect(page.status()).toBe("deleted")
    expect(page.notice()).toBeString()
  })
})

describe("administrator user-session revocation through the confirmation dialog", () => {
  test("cancelling keeps every session listed", async () => {
    const confirmState = adminConfirmStateCreate()
    const page = adminPageCreate(confirmState, "user-detail")
    await Promise.resolve()
    await Promise.resolve()
    const before = page.userSecurity.sessions().length
    expect(before).toBeGreaterThan(0)
    const sessionId = page.userSecurity.sessions()[0]?.id ?? ""

    const pending = page.userSecurity.sessionRevoke(sessionId)
    await Promise.resolve()
    expect(confirmState.open()).toBe(true)
    confirmState.cancel()
    await pending

    expect(page.userSecurity.sessions()).toHaveLength(before)
    expect(page.userSecurity.notice()).toBeUndefined()
  })

  test("confirming revokes exactly the chosen session", async () => {
    const confirmState = adminConfirmStateCreate()
    const page = adminPageCreate(confirmState, "user-detail")
    await Promise.resolve()
    await Promise.resolve()
    const before = page.userSecurity.sessions().length
    const sessionId = page.userSecurity.sessions()[0]?.id ?? ""

    const pending = page.userSecurity.sessionRevoke(sessionId)
    await Promise.resolve()
    confirmState.accept()
    await pending

    expect(page.userSecurity.sessions()).toHaveLength(before - 1)
    expect(page.userSecurity.sessions().some((item) => item.id === sessionId)).toBe(false)
    expect(page.userSecurity.notice()).toBeString()
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
