import { expect, test } from "bun:test"
import { flush, createRoot } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { accountFactorsSectionStateCreate } from "./accountFactorsSectionStateCreate.js"
import type { AccountSecurityViewState } from "./accountSecurityViewState.js"

test("authenticator rows select only their own management dialog and reset on close", () => {
  createRoot((dispose) => {
    const state = accountFactorsSectionStateCreate(() => ({}) as AccountSecurityViewState)

    return () => {
      flush()
      state.renameDialogOpenSet("first", "First authenticator", true)
      flush()
      expect(state.renameDialogOpen("first")).toBe(true)
      expect(state.renameLabel()).toBe("First authenticator")
      state.renameDialogOpenSet("second", "Second authenticator", true)
      flush()
      expect(state.renameDialogOpen("first")).toBe(false)
      expect(state.renameDialogOpen("second")).toBe(true)
      state.renameDialogOpenSet("first", "First authenticator", false)
      flush()
      expect(state.renameDialogOpen("second")).toBe(true)
      state.renameDialogOpenSet("second", "Second authenticator", false)
      flush()
      expect(state.renameDialogOpen("second")).toBe(false)
      dispose()
    }
  })()
})

test("authenticator removal closes its management dialog when step-up starts or removal succeeds", async () => {
  await createRoot((dispose) => {
    const stepUpEnrollmentId = createSignalObject<string | undefined>(undefined)
    let removed = false
    const security = {
      totpRemove: async (_enrollmentId: string) => removed,
      totpRemoveStepUpEnrollmentId: stepUpEnrollmentId.get,
    } as AccountSecurityViewState
    const state = accountFactorsSectionStateCreate(() => security)

    return async () => {
      flush()
      state.renameDialogOpenSet("first", "First authenticator", true)
      await state.renameRemove("first")
      flush()
      expect(state.renameDialogOpen("first")).toBe(true)

      stepUpEnrollmentId.set("first")
      await state.renameRemove("first")
      flush()
      expect(state.renameDialogOpen("first")).toBe(false)

      stepUpEnrollmentId.set(undefined)
      removed = true
      flush()
      state.renameDialogOpenSet("second", "Second authenticator", true)
      await state.renameRemove("second")
      flush()
      expect(state.renameDialogOpen("second")).toBe(false)
      dispose()
    }
  })()
})
