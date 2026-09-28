import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { accountFactorsSectionStateCreate } from "./accountFactorsSectionStateCreate.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

test("authenticator rows select only their own management dialog and reset on close", () => {
  createRoot((dispose) => {
    const state = accountFactorsSectionStateCreate(() => ({}) as AccountSecurityViewState)

    state.renameDialogOpenSet("first", "First authenticator", true)
    expect(state.renameDialogOpen("first")).toBe(true)
    expect(state.renameLabel()).toBe("First authenticator")
    state.renameDialogOpenSet("second", "Second authenticator", true)
    expect(state.renameDialogOpen("first")).toBe(false)
    expect(state.renameDialogOpen("second")).toBe(true)
    state.renameDialogOpenSet("first", "First authenticator", false)
    expect(state.renameDialogOpen("second")).toBe(true)
    state.renameDialogOpenSet("second", "Second authenticator", false)
    expect(state.renameDialogOpen("second")).toBe(false)
    dispose()
  })
})

test("authenticator removal closes its management dialog when step-up starts or removal succeeds", async () => {
  await createRoot(async (dispose) => {
    const stepUpEnrollmentId = createSignalObject<string | undefined>(undefined)
    let removed = false
    const security = {
      totpRemove: async (_enrollmentId: string) => removed,
      totpRemoveStepUpEnrollmentId: stepUpEnrollmentId.get,
    } as AccountSecurityViewState
    const state = accountFactorsSectionStateCreate(() => security)

    state.renameDialogOpenSet("first", "First authenticator", true)
    await state.renameRemove("first")
    expect(state.renameDialogOpen("first")).toBe(true)

    stepUpEnrollmentId.set("first")
    await state.renameRemove("first")
    expect(state.renameDialogOpen("first")).toBe(false)

    stepUpEnrollmentId.set(undefined)
    removed = true
    state.renameDialogOpenSet("second", "Second authenticator", true)
    await state.renameRemove("second")
    expect(state.renameDialogOpen("second")).toBe(false)
    dispose()
  })
})
