import { createEffect, onCleanup } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { authenticatedSelectAriaControlsApply } from "./authenticatedSelectAriaControlsApply.js"

/**
 * Tracks the popover open state of a vendored select and keeps its trigger's `aria-controls`
 * reference resolvable, because the vendored trigger keeps pointing at a listbox id that is absent
 * while the popover is closed. The trigger is observed as well as the open state, since the
 * vendored component writes the attribute after this component's effects first run.
 */
export function authenticatedSelectStateCreate() {
  const open = createSignalObject(false)
  // The container is a signal because the select may mount after this state is created.
  const container = createSignalObject<HTMLElement | undefined>(undefined)
  let rememberedId: string | undefined

  const apply = () => {
    rememberedId = authenticatedSelectAriaControlsApply({
      open: open.get(),
      rememberedId,
      trigger: container.get()?.querySelector("button") ?? undefined,
    })
  }

  createEffect(() => {
    apply()
    const trigger = container.get()?.querySelector("button")
    if (trigger === null || trigger === undefined) return
    const observer = new MutationObserver(apply)
    observer.observe(trigger, { attributeFilter: ["aria-controls"] })
    onCleanup(() => observer.disconnect())
  })

  return {
    containerSet: (element: HTMLElement) => container.set(element),
    open: open.get,
    openChange: (next: boolean) => open.set(next),
  }
}
