import { expect, test } from "bun:test"
import { authenticatedEntityCardStateCreate } from "../../src/ui/authenticated/authenticatedEntityCardStateCreate.js"

test("entity card click and keyboard activation defer to its current link", () => {
  let href: string | undefined
  let activations = 0
  let prevented = 0
  const target = new EventTarget()
  const space = {
    currentTarget: target,
    key: " ",
    preventDefault: () => {
      prevented += 1
    },
    target,
  } as unknown as KeyboardEvent
  const state = authenticatedEntityCardStateCreate({
    href: () => href,
    onActivate: () => () => {
      activations += 1
    },
  })

  href = "/demo/admin/users"
  state.activate()
  state.keyDown(space)
  expect(activations).toBe(0)
  expect(prevented).toBe(0)

  href = undefined
  state.activate()
  state.keyDown(space)
  expect(activations).toBe(2)
  expect(prevented).toBe(1)
})
