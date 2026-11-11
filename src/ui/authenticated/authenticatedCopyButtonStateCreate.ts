import { onCleanup } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"

export function authenticatedCopyButtonStateCreate(options: {
  readonly value: () => string
  readonly writeText?: (value: string) => Promise<void>
}) {
  const feedback = createSignalObject<"copied" | "failed" | undefined>(undefined)
  let timer: ReturnType<typeof setTimeout> | undefined
  let request = 0
  onCleanup(() => {
    request++
    clearTimeout(timer)
  })
  const write = async () => {
    const value = options.value()
    if (!value) return
    const current = ++request
    clearTimeout(timer)
    feedback.set(undefined)
    try {
      await (options.writeText ?? ((text: string) => navigator.clipboard.writeText(text)))(value)
      if (current !== request) return
      feedback.set("copied")
    } catch {
      if (current !== request) return
      feedback.set("failed")
    }
    timer = setTimeout(() => {
      if (current === request) feedback.set(undefined)
    }, 3000)
  }
  return {
    copied: () => feedback.get() === "copied",
    failed: () => feedback.get() === "failed",
    copy: (event: MouseEvent) => {
      event.stopPropagation()
      event.preventDefault()
      void write()
    },
  }
}
