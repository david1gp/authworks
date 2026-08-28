import { describe, expect, test } from "bun:test"
import { confirmStateCreate } from "./confirmStateCreate.js"

describe("confirmStateCreate", () => {
  test("a plain message keeps the generic title and accept label", () => {
    const state = confirmStateCreate()
    void state.confirm("Remove this project?")

    expect(state.message()).toBe("Remove this project?")
    expect(state.title()).toBeUndefined()
    expect(state.acceptLabel()).toBeUndefined()
  })

  test("a named request carries its own title and accept label", () => {
    const state = confirmStateCreate()
    void state.confirm({
      acceptLabel: "Remove project",
      message: "Remove this project?",
      title: "Remove this project",
    })

    expect(state.message()).toBe("Remove this project?")
    expect(state.title()).toBe("Remove this project")
    expect(state.acceptLabel()).toBe("Remove project")
  })

  test("settling clears the named copy so the next prompt cannot inherit it", async () => {
    const state = confirmStateCreate()
    const pending = state.confirm({ acceptLabel: "Delete project", message: "Delete?", title: "Delete this project" })
    state.accept()

    expect(await pending).toBe(true)
    expect(state.open()).toBe(false)
    expect(state.title()).toBeUndefined()
    expect(state.acceptLabel()).toBeUndefined()
  })
})
