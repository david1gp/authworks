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
  { confirmDialogFocusNextSelect: oidcAdminDialogFocusNextSelect },
  { oidcAdminPageStateCreate },
  { oidcAdminDemoAdapterCreate },
] = await Promise.all([
  import("../../src/ui/confirm/confirmStateCreate.js"),
  import("../../src/ui/confirm/confirmDialogFocusNextSelect.js"),
  import("../../src/features/oidc/ui/oidcAdminPageStateCreate.js"),
  import("../../src/features/oidc/ui/oidcAdminDemoAdapterCreate.js"),
])

const confidentialClientId = "01900000-0000-7000-8000-000000000041"
// The dialog renders cancel first so the destructive choice is never the default.
const dialogControls = ["cancel", "accept"] as const

describe("confirmation dialog focus containment", () => {
  test("moves forward through the dialog controls and wraps back to the first", () => {
    expect(oidcAdminDialogFocusNextSelect({ active: "cancel", backwards: false, elements: dialogControls })).toBe(
      "accept",
    )
    expect(oidcAdminDialogFocusNextSelect({ active: "accept", backwards: false, elements: dialogControls })).toBe(
      "cancel",
    )
  })

  test("moves backward on Shift+Tab and wraps to the last control", () => {
    expect(oidcAdminDialogFocusNextSelect({ active: "accept", backwards: true, elements: dialogControls })).toBe(
      "cancel",
    )
    expect(oidcAdminDialogFocusNextSelect({ active: "cancel", backwards: true, elements: dialogControls })).toBe(
      "accept",
    )
  })

  test("pulls focus back inside when it sits outside the dialog", () => {
    expect(oidcAdminDialogFocusNextSelect({ active: "page-button", backwards: false, elements: dialogControls })).toBe(
      "cancel",
    )
    expect(oidcAdminDialogFocusNextSelect({ active: undefined, backwards: true, elements: dialogControls })).toBe(
      "accept",
    )
  })

  test("has nothing to focus when the dialog is closed", () => {
    expect(oidcAdminDialogFocusNextSelect({ active: undefined, backwards: false, elements: [] })).toBeUndefined()
  })
})

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
