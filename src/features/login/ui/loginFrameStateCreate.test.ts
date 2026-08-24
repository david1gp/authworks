import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test"
import { Window } from "happy-dom"

type LoginFrameStateCreate = typeof import("./loginFrameStateCreate.js")["loginFrameStateCreate"]

const solidRuntimePath = "../../../../node_modules/solid-js/dist/dev.js"
const solidWebRuntimePath = "../../../../node_modules/solid-js/web/dist/web.js"
mock.module("solid-js", () => import(solidRuntimePath))
mock.module("solid-js/web", () => import(solidWebRuntimePath))

let createRoot: typeof import("solid-js").createRoot
let loginFrameStateCreate: LoginFrameStateCreate

beforeAll(async () => {
  createRoot = (await import("solid-js")).createRoot
  loginFrameStateCreate = (await import("./loginFrameStateCreate.js")).loginFrameStateCreate
})

afterAll(() => mock.restore())

const globalValues = globalThis as unknown as Record<string, unknown>
const globalNames = ["document", "localStorage", "window"] as const
const previousGlobals = new Map<string, unknown>()
const cleanups: Array<() => void> = []

function storageCreate(
  initial: Record<string, string> = {},
  options: { readonly getItem?: Storage["getItem"]; readonly setItem?: Storage["setItem"] } = {},
): Storage {
  const values = new Map(Object.entries(initial))
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: options.getItem ?? ((key) => values.get(key) ?? null),
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: options.setItem ?? ((key, value) => values.set(key, value)),
  }
}

function bootstrapCreate() {
  return {
    branding: {
      dark: { backgroundColor: "#111827", fontColor: "#f9fafb", primaryColor: "#60a5fa", warnColor: "#f87171" },
      disableWatermark: true,
      light: { backgroundColor: "#f8fafc", fontColor: "#111827", primaryColor: "#2563eb", warnColor: "#dc2626" },
      themeMode: "system" as const,
    },
  }
}

function stateCreate(storage: Storage) {
  const browserWindow = new Window()
  for (const name of globalNames) previousGlobals.set(name, globalValues[name])
  globalValues.document = browserWindow.document
  globalValues.localStorage = storage
  globalValues.window = browserWindow

  let dispose: (() => void) | undefined
  const state = createRoot((rootDispose) => {
    dispose = rootDispose
    return loginFrameStateCreate(bootstrapCreate, () => "password")
  })
  cleanups.push(() => {
    dispose?.()
    for (const name of globalNames) {
      const previous = previousGlobals.get(name)
      if (previous === undefined) delete globalValues[name]
      else globalValues[name] = previous
    }
    previousGlobals.clear()
  })
  return state
}

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

describe("loginFrameStateCreate theme preference", () => {
  test("loads and persists the selected theme", () => {
    const storage = storageCreate({ theme: "dark" })
    const state = stateCreate(storage)
    const lightOption = state.themeOptions[0]
    if (lightOption === undefined) throw new Error("Light theme option was not created.")

    expect(state.effectiveTheme()).toBe("dark")
    lightOption.onSelect()
    expect(state.effectiveTheme()).toBe("light")
    expect(storage.getItem("theme")).toBe("light")
  })

  test("falls back to system when reading storage throws", () => {
    const storage = storageCreate(
      {},
      {
        getItem: () => {
          throw new Error("restricted")
        },
      },
    )
    const state = stateCreate(storage)

    expect(state.effectiveTheme()).toBe("light")
  })

  test("keeps the login usable when saving storage throws", () => {
    const storage = storageCreate(
      {},
      {
        setItem: () => {
          throw new Error("quota")
        },
      },
    )
    const state = stateCreate(storage)
    const darkOption = state.themeOptions[1]
    if (darkOption === undefined) throw new Error("Dark theme option was not created.")

    expect(() => darkOption.onSelect()).not.toThrow()
    expect(state.effectiveTheme()).toBe("dark")
  })
})
