/**
 * Selection is deferred until the popover has restored focus to its trigger. Running an item's
 * action synchronously lets it open a modal dialog first; the popover's late focus restore then
 * lands outside that dialog, whose focus trap treats it as an outside focus and closes it again.
 */
export function authenticatedActionMenuStateCreate(options: { readonly onOpenChange: (open: boolean) => void }) {
  let pending: (() => void) | undefined
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined

  const pendingRun = () => {
    if (fallbackTimer !== undefined) clearTimeout(fallbackTimer)
    fallbackTimer = undefined
    const action = pending
    pending = undefined
    action?.()
  }

  const focusablesGet = (current: HTMLElement): readonly HTMLElement[] => {
    const container = current.closest("[role='menu']")
    if (container === null) return []
    return [...container.querySelectorAll<HTMLElement>("[role='menuitem']:not([aria-disabled='true'])")]
  }
  const keyNavigate = (event: KeyboardEvent, current: HTMLElement) => {
    const buttons = focusablesGet(current)
    const currentIndex = buttons.indexOf(current)
    if (event.key === "ArrowDown") {
      event.preventDefault()
      buttons[(currentIndex + 1) % buttons.length]?.focus()
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      buttons[(currentIndex - 1 + buttons.length) % buttons.length]?.focus()
    } else if (event.key === "Home") {
      event.preventDefault()
      buttons[0]?.focus()
    } else if (event.key === "End") {
      event.preventDefault()
      buttons[buttons.length - 1]?.focus()
    } else if (event.key === "Escape") {
      options.onOpenChange(false)
    }
  }
  return {
    select: (item: { readonly disabled?: boolean; readonly onSelect: () => void }) => () => {
      if (item.disabled) return
      options.onOpenChange(false)
      pending = item.onSelect
      // Safety net in case the popover never reports its final focus (e.g. it was unmounted).
      if (fallbackTimer !== undefined) clearTimeout(fallbackTimer)
      fallbackTimer = setTimeout(pendingRun, 250)
    },
    /** Runs the selected action right after the popover has moved focus back to its trigger. */
    finalFocus: () => {
      if (pending === undefined) return
      setTimeout(pendingRun, 0)
    },
    // Arrow keys, Home, and End move between enabled items. Enter and Space are intentionally
    // left to native button activation so the wrapping `Popover.Close` runs and dismisses the
    // menu; Escape is handled natively by the corvu dismissible for the same reason.
    itemKeyDown:
      () =>
      (event: KeyboardEvent & { currentTarget: HTMLElement }): void => {
        if (event.key === "Enter" || event.key === " ") return
        keyNavigate(event, event.currentTarget)
      },
  }
}
