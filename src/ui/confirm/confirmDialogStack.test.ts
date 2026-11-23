import { describe, expect, test } from "bun:test"
import { createEffect, createRoot, flush } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { confirmDialogStack } from "./confirmDialogStack.js"

describe("confirmDialogStack", () => {
  test("keeps underlying dialogs suspended until the last confirmation leaves", () => {
    const leaveFirst = confirmDialogStack.enter()
    const leaveSecond = confirmDialogStack.enter()
    flush()
    expect(confirmDialogStack.active()).toBe(true)
    leaveFirst()
    flush()
    expect(confirmDialogStack.active()).toBe(true)
    leaveSecond()
    flush()
    expect(confirmDialogStack.active()).toBe(false)
  })

  test("entering a layer inside an effect never subscribes the effect to stack changes", async () => {
    let activations = 0
    const state = createRoot((dispose) => {
      const open = createSignalObject(false)
      createEffect(open.get, (opened) => {
        if (!opened) return
        activations += 1
        return confirmDialogStack.enter()
      })
      return { dispose, open }
    })
    flush()
    state.open.set(true)
    flush()
    expect(confirmDialogStack.active()).toBe(true)
    expect(activations).toBe(1)
    state.open.set(false)
    flush()
    expect(confirmDialogStack.active()).toBe(false)
    expect(activations).toBe(1)
    state.dispose()
  })
})
