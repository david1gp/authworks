export function authenticatedActionMenuStateCreate(options: { readonly onOpenChange: (open: boolean) => void }) {
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
      item.onSelect()
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
