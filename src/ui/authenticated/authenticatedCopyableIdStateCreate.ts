import { onCleanup } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"

/** Clipboard feedback is only shown after a successful write. */
export function authenticatedCopyableIdStateCreate(value: () => string) {
  const copied = createSignalObject(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(timer))
  return {
    copied: copied.get,
    copy: async () => {
      try {
        await navigator.clipboard.writeText(value())
        copied.set(true)
        clearTimeout(timer)
        timer = setTimeout(() => copied.set(false), 2000)
      } catch {
        copied.set(false)
      }
    },
    text: () => (value().length > 18 ? `${value().slice(0, 8)}…${value().slice(-4)}` : value()),
  }
}
