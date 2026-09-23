import { describe, expect, mock, test } from "bun:test"

// The Solid runtime is not resolvable under the test condition, so the two primitives the
// page state uses are replaced with equivalent non-reactive behaviour.
mock.module("solid-js", () => ({
  createEffect: (effect: (previous?: unknown) => unknown) => effect(),
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (dependency: () => unknown, handler: (value: unknown) => unknown) => () => handler(dependency()),
}))

const [
  { confirmStateCreate: oidcAdminConfirmStateCreate },
  { oidcAdminPageStateCreate },
  { oidcAdminDemoAdapterCreate },
] = await Promise.all([
  import("../../src/ui/confirm/confirmStateCreate.js"),
  import("../../src/features/oidc/ui/oidcAdminPageStateCreate.js"),
  import("../../src/features/oidc/ui/oidcAdminDemoAdapterCreate.js"),
])

const confidentialClientId = "01900000-0000-7000-8000-000000000041"
const pageStateCreate = (confirmState: ReturnType<typeof oidcAdminConfirmStateCreate>) =>
  oidcAdminPageStateCreate({
    adapter: oidcAdminDemoAdapterCreate(() => "success"),
    clientId: () => confidentialClientId,
    confirm: confirmState.confirm,
    consentUserId: () => undefined,
    screen: () => "oidc-client-detail",
  })

describe("destructive OIDC actions through the styled dialog", () => {
  test("accepting the dialog performs the rotation and issues a one-time secret", async () => {
    const confirmState = oidcAdminConfirmStateCreate()
    const page = pageStateCreate(confirmState)

    const pending = page.clientSecretRotate(confidentialClientId)
    await Promise.resolve()
    expect(confirmState.open()).toBe(true)
    confirmState.accept()
    await pending

    expect(confirmState.open()).toBe(false)
    expect(page.issuedSecret()?.clientId).toBe(confidentialClientId)
    expect(page.issuedSecret()?.kind).toBe("rotated")
  })

  test("cancelling the dialog leaves no secret issued and no change applied", async () => {
    const confirmState = oidcAdminConfirmStateCreate()
    const page = pageStateCreate(confirmState)

    const pending = page.clientSecretRevoke(confidentialClientId)
    await Promise.resolve()
    confirmState.cancel()
    await pending

    expect(confirmState.open()).toBe(false)
    expect(page.issuedSecret()).toBeUndefined()
    expect(page.notice()).toBeUndefined()
  })
})
