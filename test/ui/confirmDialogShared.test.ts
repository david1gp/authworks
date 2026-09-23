import { describe, expect, mock, test } from "bun:test"

// The Solid runtime is not resolvable under the test condition, so the primitives the state
// creators use are replaced with equivalent non-reactive behaviour.
mock.module("solid-js", () => ({
  createEffect: (effect: (previous?: unknown) => unknown) => effect(),
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (dependency: () => unknown, handler: (value: unknown) => unknown) => () => handler(dependency()),
}))

const [
  { confirmStateCreate },
  { adminPageStateCreate },
  { adminDemoAdapterCreate },
  { oidcAdminPageStateCreate },
  { oidcAdminDemoAdapterCreate },
  { impersonationAdminPageStateCreate },
  { impersonationAdminDemoAdapterCreate },
  { demoAdminImpersonationNow },
  { englishCatalog },
] = await Promise.all([
  import("../../src/ui/confirm/confirmStateCreate.js"),
  import("../../src/features/admin/ui/adminPageStateCreate.js"),
  import("../../src/features/admin/ui/adminDemoAdapterCreate.js"),
  import("../../src/features/oidc/ui/oidcAdminPageStateCreate.js"),
  import("../../src/features/oidc/ui/oidcAdminDemoAdapterCreate.js"),
  import("../../src/features/impersonation/ui/impersonationAdminPageStateCreate.js"),
  import("../../src/features/impersonation/ui/impersonationAdminDemoAdapterCreate.js"),
  import("../../src/features/demo/demoAdminImpersonationNow.js"),
  import("../../src/ui/i18n/model/englishCatalog.js"),
])

const alexId = "01900000-0000-7000-8000-000000000021"
const confidentialClientId = "01900000-0000-7000-8000-000000000041"

describe("shared confirmation state", () => {
  test("opens with the given message and resolves true only when accepted", async () => {
    const state = confirmStateCreate()

    expect(state.open()).toBe(false)
    const pending = state.confirm("Remove this?")
    expect(state.open()).toBe(true)
    expect(state.message()).toBe("Remove this?")
    state.accept()

    expect(await pending).toBe(true)
    expect(state.open()).toBe(false)
    expect(state.message()).toBeUndefined()
  })

  test("cancelling declines the action and closes the prompt", async () => {
    const state = confirmStateCreate()
    const pending = state.confirm("Remove this?")
    state.cancel()

    expect(await pending).toBe(false)
    expect(state.open()).toBe(false)
  })

  test("a superseding prompt declines the previous one so no caller waits forever", async () => {
    const state = confirmStateCreate()
    const first = state.confirm("first")
    const second = state.confirm("second")

    expect(await first).toBe(false)
    expect(state.message()).toBe("second")
    state.accept()
    expect(await second).toBe(true)
  })

  test("an unmount settles the open prompt as declined", async () => {
    const state = confirmStateCreate()
    const pending = state.confirm("Remove this?")

    // The dialog calls this from its Solid cleanup when the screen goes away.
    state.dispose()

    expect(await pending).toBe(false)
    expect(state.open()).toBe(false)
  })
})

describe("features routed through the shared confirmation", () => {
  test("administration realm disabling is cancelable and applies only when accepted", async () => {
    const state = confirmStateCreate()
    const page = adminPageStateCreate({
      adapter: adminDemoAdapterCreate(() => "success", { signedInInitially: true }),
      confirm: state.confirm,
      screen: () => "realm",
    })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    page.realmStatus.set("disabled")

    const submit = { preventDefault: () => undefined } as SubmitEvent
    const cancelled = page.realmSave(submit)
    await Promise.resolve()
    expect(state.open()).toBe(true)
    expect(state.message()).toBe(englishCatalog["admin.realm.disableConfirm"])
    state.cancel()
    await cancelled
    expect(page.realm()?.status).not.toBe("disabled")

    page.realmStatus.set("disabled")
    const accepted = page.realmSave(submit)
    await Promise.resolve()
    state.accept()
    await accepted
    expect(page.realm()?.status).toBe("disabled")
  })

  test("administration user lifecycle is confirmed before the mutation", async () => {
    const state = confirmStateCreate()
    const page = adminPageStateCreate({
      adapter: adminDemoAdapterCreate(() => "success", { signedInInitially: true }),
      confirm: state.confirm,
      screen: () => "user-detail",
      userId: () => alexId,
    })
    await Promise.resolve()
    await Promise.resolve()

    const cancelled = page.userLifecycleSet("locked")
    await Promise.resolve()
    expect(state.open()).toBe(true)
    state.cancel()
    await cancelled
    expect(page.user()?.state).not.toBe("locked")

    const accepted = page.userLifecycleSet("locked")
    await Promise.resolve()
    state.accept()
    await accepted
    expect(page.user()?.state).toBe("locked")
  })

  test("OIDC secret rotation is confirmed through the same primitive", async () => {
    const state = confirmStateCreate()
    const page = oidcAdminPageStateCreate({
      adapter: oidcAdminDemoAdapterCreate(() => "success"),
      clientId: () => confidentialClientId,
      confirm: state.confirm,
      consentUserId: () => undefined,
      screen: () => "oidc-client-detail",
    })
    await Promise.resolve()
    await Promise.resolve()

    const cancelled = page.clientSecretRotate(confidentialClientId)
    await Promise.resolve()
    expect(state.open()).toBe(true)
    expect(state.message()).toBe(englishCatalog["admin.oidc.secret.rotateConfirm"])
    state.cancel()
    await cancelled
    expect(page.issuedSecret()).toBeUndefined()

    const accepted = page.clientSecretRotate(confidentialClientId)
    await Promise.resolve()
    state.accept()
    await accepted
    expect(page.issuedSecret()?.kind).toBe("rotated")
  })

  test("impersonation end is confirmed through the same primitive", async () => {
    const state = confirmStateCreate()
    const page = impersonationAdminPageStateCreate({
      adapter: impersonationAdminDemoAdapterCreate(() => "active"),
      confirm: state.confirm,
      now: () => demoAdminImpersonationNow,
    })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    const pending = page.impersonationEnd()
    await Promise.resolve()
    expect(state.open()).toBe(true)
    state.accept()
    await pending

    expect(page.active()).toBeNull()
  })
})
