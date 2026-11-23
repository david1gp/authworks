import { createSignal } from "solid-js"

// Corvu manages each layer's focus and pointer interactions. A confirmation mounted by a
// screen adapter is a sibling of its underlying dialog, so suspend that dialog's trap and
// outside dismissal while Corvu's confirmation is the active modal layer.
const [count, countSet] = createSignal(0)

export const confirmDialogStack = {
  active: () => count() > 0,
  enter: () => {
    countSet((current) => current + 1)
    return () => {
      countSet((current) => current - 1)
    }
  },
}
