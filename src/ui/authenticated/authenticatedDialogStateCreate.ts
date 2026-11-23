import { createEffect, createSignal, createUniqueId } from "solid-js"

export function authenticatedDialogStateCreate(open: () => boolean) {
  const dialogId = createUniqueId()
  const [trigger, triggerRegister] = createSignal<HTMLButtonElement | undefined>(undefined)
  const finalFocusEl = () => {
    const element = trigger()
    return element?.isConnected && !element.disabled && element.getClientRects().length > 0 ? element : undefined
  }

  createEffect(
    () => ({ element: trigger(), openNow: open() }),
    ({ element, openNow }, previous) => {
      if (openNow) element?.setAttribute("aria-controls", dialogId)
      else element?.removeAttribute("aria-controls")
      if (previous?.openNow && !openNow) queueMicrotask(() => finalFocusEl()?.focus())
    },
  )

  return {
    dialogId,
    densityGet: () =>
      (trigger() ?? (typeof document === "undefined" ? undefined : document.activeElement))?.closest(
        '[data-density="compact"]',
      )
        ? "compact"
        : undefined,
    finalFocusEl,
    triggerRegister: (element: HTMLButtonElement) => {
      triggerRegister(element)
    },
  }
}
