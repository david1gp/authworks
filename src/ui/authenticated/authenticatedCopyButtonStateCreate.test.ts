import { describe, expect, test, mock } from "bun:test"
import { createRoot } from "solid-js"
import { authenticatedCopyButtonStateCreate } from "./authenticatedCopyButtonStateCreate.js"

const eventCreate = () => ({ stopPropagation: mock(() => {}), preventDefault: mock(() => {}) })

describe("authenticatedCopyButtonStateCreate", () => {
  test("copies the full value, suppresses navigation and resets feedback", async () => {
    const writeText = mock(async (_value: string) => {})
    const event = eventCreate()
    let reset: (() => void) | undefined
    const original = globalThis.setTimeout
    globalThis.setTimeout = ((callback: () => void) => {
      reset = callback
      return 0
    }) as typeof setTimeout
    try {
      await createRoot(async (dispose) => {
        const state = authenticatedCopyButtonStateCreate({ value: () => "complete value", writeText })
        state.copy(event as unknown as MouseEvent)
        expect(event.stopPropagation).toHaveBeenCalledTimes(1)
        expect(event.preventDefault).toHaveBeenCalledTimes(1)
        await Promise.resolve()
        expect(writeText).toHaveBeenCalledWith("complete value")
        expect(state.copied()).toBe(true)
        reset?.()
        expect(state.copied()).toBe(false)
        dispose()
      })
    } finally {
      globalThis.setTimeout = original
    }
  })
  test("reports a rejected clipboard write", async () => {
    await createRoot(async (dispose) => {
      const state = authenticatedCopyButtonStateCreate({
        value: () => "value",
        writeText: async () => {
          throw new Error("denied")
        },
      })
      state.copy(eventCreate() as unknown as MouseEvent)
      await Promise.resolve()
      expect(state.failed()).toBe(true)
      dispose()
    })
  })
  test("does not write an empty value but still suppresses navigation", () => {
    createRoot((dispose) => {
      const writeText = mock(async (_value: string) => {})
      const state = authenticatedCopyButtonStateCreate({ value: () => "", writeText })
      const event = eventCreate()
      state.copy(event as unknown as MouseEvent)
      expect(writeText).not.toHaveBeenCalled()
      expect(event.stopPropagation).toHaveBeenCalledTimes(1)
      expect(event.preventDefault).toHaveBeenCalledTimes(1)
      dispose()
    })
  })
})
