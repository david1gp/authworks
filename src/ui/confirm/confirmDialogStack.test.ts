import { describe, expect, test } from "bun:test"
import { createEffect, createRoot, onCleanup } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { confirmDialogStack } from "./confirmDialogStack.js"

describe("confirmDialogStack", () => {
  test("keeps underlying dialogs suspended until the last confirmation leaves", () => {
    const leaveFirst = confirmDialogStack.enter()
    const leaveSecond = confirmDialogStack.enter()
    expect(confirmDialogStack.active()).toBe(true)
    leaveFirst()
    expect(confirmDialogStack.active()).toBe(true)
    leaveSecond()
    expect(confirmDialogStack.active()).toBe(false)
  })

  test("entering a layer inside an effect never subscribes the effect to stack changes", async () => {
    let activations = 0
    const state = createRoot((dispose) => {
      const open = createSignalObject(false)
      createEffect(() => {
        if (!open.get()) return
        activations += 1
        onCleanup(confirmDialogStack.enter())
      })
      open.set(true)
      return { dispose, open }
    })
    await Promise.resolve()
    expect(confirmDialogStack.active()).toBe(true)
    expect(activations).toBe(1)
    state.open.set(false)
    expect(confirmDialogStack.active()).toBe(false)
    expect(activations).toBe(1)
    state.dispose()
  })
})
