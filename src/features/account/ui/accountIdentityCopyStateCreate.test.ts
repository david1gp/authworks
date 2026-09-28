import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { accountIdentityCopyStateCreate } from "./accountIdentityCopyStateCreate.js"

test("copies the latest identity value and reports success", async () => {
  const values: string[] = []
  let value = "old@example.com"
  await createRoot(async (dispose) => {
    const state = accountIdentityCopyStateCreate({
      value: () => value,
      writeText: async (text) => {
        values.push(text)
      },
    })
    value = "new@example.com"
    state.copy()
    await Promise.resolve()
    expect(values).toEqual(["new@example.com"])
    expect(state.feedback()).toBe("copied")
    dispose()
  })
})

test("reports denied clipboard access without throwing or copying missing values", async () => {
  let value = ""
  let attempts = 0
  await createRoot(async (dispose) => {
    const state = accountIdentityCopyStateCreate({
      value: () => value,
      writeText: async () => {
        attempts += 1
        throw new Error("denied")
      },
    })
    state.copy()
    expect(attempts).toBe(0)
    value = "+14155552671"
    state.copy()
    await Promise.resolve()
    expect(attempts).toBe(1)
    expect(state.feedback()).toBe("failed")
    dispose()
  })
})
