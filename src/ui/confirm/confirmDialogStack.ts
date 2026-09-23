import { createSignalObject } from "#ui/utils/createSignalObject.js"
import { untrack } from "solid-js"

// Corvu manages each layer's focus and pointer interactions. A confirmation mounted by a
// screen adapter is a sibling of its underlying dialog, so suspend that dialog's trap and
// outside dismissal while Corvu's confirmation is the active modal layer.
const count = createSignalObject(0)

export const confirmDialogStack = {
  active: () => count.get() > 0,
  enter: () => {
    untrack(() => count.set(count.get() + 1))
    return () => untrack(() => count.set(count.get() - 1))
  },
}
