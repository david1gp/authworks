/**
 * Keeps a popover trigger's `aria-controls` reference resolvable. The vendored trigger always
 * writes the attribute, so while the portalled listbox is unmounted the reference dangles. The
 * attribute is removed while the popover is closed and restored from the remembered id when it
 * opens again.
 *
 * Returns the id to remember for the next call.
 */
export function authenticatedSelectAriaControlsApply(input: {
  readonly open: boolean
  readonly rememberedId?: string
  readonly trigger?: Element
}): string | undefined {
  const { open, rememberedId, trigger } = input
  if (trigger === undefined) return rememberedId

  if (!open) {
    const current = trigger.getAttribute("aria-controls") ?? rememberedId
    trigger.removeAttribute("aria-controls")
    return current ?? undefined
  }

  if (rememberedId !== undefined && trigger.getAttribute("aria-controls") === null) {
    trigger.setAttribute("aria-controls", rememberedId)
  }
  return rememberedId
}
