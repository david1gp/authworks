import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

const [{ authenticatedActionMenuStateCreate }, { productionOrganizationSwitcherStateCreate }] = await Promise.all([
  import("../../src/ui/authenticated/authenticatedActionMenuStateCreate.js"),
  import("../../src/ui/production/productionOrganizationSwitcherStateCreate.js"),
])

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))

test("menu actions run only after the popover restores focus, so a dialog opened from the menu stays open", async () => {
  const closed: boolean[] = []
  const state = authenticatedActionMenuStateCreate({ onOpenChange: (open) => closed.push(open) })
  let ran = 0
  state.select({ onSelect: () => ran++ })()
  expect(closed).toEqual([false])
  expect(ran).toBe(0)
  state.finalFocus()
  expect(ran).toBe(0)
  await tick()
  expect(ran).toBe(1)
  // The safety timer must not run the action a second time.
  await tick(300)
  expect(ran).toBe(1)
})

test("menu actions still run when the popover never reports final focus", async () => {
  const state = authenticatedActionMenuStateCreate({ onOpenChange: () => {} })
  let ran = 0
  state.select({ onSelect: () => ran++ })()
  await tick(300)
  expect(ran).toBe(1)
})

test("disabled menu actions never run", async () => {
  const state = authenticatedActionMenuStateCreate({ onOpenChange: () => {} })
  let ran = 0
  state.select({ disabled: true, onSelect: () => ran++ })()
  state.finalFocus()
  await tick(300)
  expect(ran).toBe(0)
})

test("the organization switcher filters by name and ignores reselecting the active organization", () => {
  createRoot((dispose) => {
    const selected: string[] = []
    const organizations = [
      { id: "a", label: "Acme Corporation" },
      { id: "b", label: "Northwind Labs" },
      ...Array.from({ length: 6 }, (_, index) => ({ id: `x${index}`, label: `Extra ${index}` })),
    ]
    const state = productionOrganizationSwitcherStateCreate({
      activeId: () => "a",
      disabled: () => false,
      onSelect: (id) => selected.push(id),
      organizations: () => organizations,
    })
    expect(state.activeLabel()).toBe("Acme Corporation")
    expect(state.activeInitials()).toBe("AC")
    expect(state.searchVisible()).toBe(true)
    state.queryInput({ currentTarget: { value: "north" } } as InputEvent & { currentTarget: HTMLInputElement })
    expect(state.filtered().map((item) => item.id)).toEqual(["b"])
    state.select("a")
    expect(selected).toEqual([])
    state.select("b")
    expect(selected).toEqual(["b"])
    // Selecting closes the menu and clears the filter.
    expect(state.open()).toBe(false)
    expect(state.query()).toBe("")
    dispose()
  })
})

test("the organization switcher does not open while switching is disabled", () => {
  createRoot((dispose) => {
    const state = productionOrganizationSwitcherStateCreate({
      activeId: () => "a",
      disabled: () => true,
      onSelect: () => {},
      organizations: () => [{ id: "a", label: "Acme" }],
    })
    state.openChange(true)
    expect(state.open()).toBe(false)
    expect(state.searchVisible()).toBe(false)
    dispose()
  })
})
