import { describe, expect, mock, test } from "bun:test"
import { resultErrorCodedCreate } from "../../../platform/errors/resultErrorCodedCreate.js"
import { resultErrorCreate } from "../../../platform/errors/resultErrorCreate.js"
import { projectAdminDemoAdapterCreate } from "./projectAdminDemoAdapterCreate.js"

mock.module("solid-js", () => ({
  createEffect: (fn: () => unknown) => fn(),
  createSignal: <T>(initial: T) => {
    let value = initial
    return [() => value, (next: T) => (value = next)] as const
  },
  on: (_dependencies: unknown, fn: () => unknown) => fn,
}))

const { projectAdminPageStateCreate } = await import("./projectAdminPageStateCreate.js")

const projectId = "01900000-0000-7000-8000-000000000031"

const flushLoad = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const stateCreate = (failure: ReturnType<typeof resultErrorCreate>) =>
  projectAdminPageStateCreate({
    adapter: {
      ...projectAdminDemoAdapterCreate(() => "success"),
      projectGet: async () => failure,
    },
    confirm: () => true,
    projectId: () => projectId,
    screen: () => "project-detail",
  })

describe("project administration error classification", () => {
  test("classifies an explicit tenant mismatch as cross-tenant", async () => {
    const failure = resultErrorCodedCreate(
      "projectGet",
      "The project is not available in this tenant context.",
      "projects.tenant-mismatch",
    )
    failure.statusCode = 404

    const state = stateCreate(failure)
    await flushLoad()

    expect(state.status()).toBe("cross-tenant")
  })

  test("keeps a projects.not-found 404 as a normal error", async () => {
    const failure = resultErrorCodedCreate("projectGet", "The project was not found.", "projects.not-found")
    failure.statusCode = 404

    const state = stateCreate(failure)
    await flushLoad()

    expect(state.status()).toBe("error")
  })

  test("keeps an uncoded generic 404 as a normal error", async () => {
    const failure = resultErrorCreate("projectGet", "The project could not be loaded.")
    failure.statusCode = 404

    const state = stateCreate(failure)
    await flushLoad()

    expect(state.status()).toBe("error")
  })
})
