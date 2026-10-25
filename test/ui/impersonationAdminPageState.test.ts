import { afterEach, describe, expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { impersonationAdminDemoAdapterCreate } from "../../src/features/impersonation/ui/impersonationAdminDemoAdapterCreate.js"
import { impersonationAdminPageStateCreate } from "../../src/features/impersonation/ui/impersonationAdminPageStateCreate.js"

const cleanups: Array<() => void> = []

afterEach(async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  for (const cleanup of cleanups.splice(0)) cleanup()
})

describe("impersonation admin page state", () => {
  test("keeps the active session visible when nesting is rejected", async () => {
    const state = stateCreate()

    const deadline = Date.now() + 5_000
    while (state.status() === "loading" && Date.now() < deadline)
      await new Promise<void>((resolve) => setTimeout(resolve, 10))

    expect(state.status()).toBe("nested-rejected")
    expect(state.active()?.sessionId).toBe("01900000-0000-7000-8000-0000000000e1")
    expect(state.users()).toEqual([])
  })
})

function stateCreate() {
  let dispose: (() => void) | undefined
  const state = createRoot((rootDispose) => {
    dispose = rootDispose
    return impersonationAdminPageStateCreate({
      adapter: impersonationAdminDemoAdapterCreate(() => "nested-rejected"),
      confirm: () => true,
      now: () => 1_774_000_000_000,
      reloadKey: () => "nested-rejected",
    })
  })
  if (dispose === undefined) throw new Error("Impersonation page state root did not provide a disposer.")
  cleanups.push(dispose)
  return state
}
