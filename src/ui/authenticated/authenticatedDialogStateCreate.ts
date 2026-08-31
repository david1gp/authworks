import { createEffect, createUniqueId } from "solid-js"

export function authenticatedDialogStateCreate(open: () => boolean) {
  const dialogId = createUniqueId()
  let openPreviously = open()
  let trigger: HTMLButtonElement | undefined

  createEffect(() => {
    const openNow = open()
    if (openNow) trigger?.setAttribute("aria-controls", dialogId)
    else trigger?.removeAttribute("aria-controls")
    if (openPreviously && !openNow) queueMicrotask(() => trigger?.focus())
    openPreviously = openNow
  })

  return {
    dialogId,
    triggerRegister: (element: HTMLButtonElement) => {
      trigger = element
    },
  }
}
