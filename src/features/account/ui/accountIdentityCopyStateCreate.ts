import { onCleanup } from "solid-js"
import { createSignalObject } from "#ui/utils/createSignalObject.js"

/** Local feedback for a single identity value; the value is read only when copying. */
export function accountIdentityCopyStateCreate(options: {
  readonly value: () => string
  readonly writeText?: (value: string) => Promise<void>
}) {
  const feedback = createSignalObject<"copied" | "failed" | undefined>(undefined)
  let timer: ReturnType<typeof setTimeout> | undefined
  let request = 0

  onCleanup(() => {
    request += 1
    clearTimeout(timer)
  })

  const copy = async () => {
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

  return { copy: () => void copy(), feedback: feedback.get }
}
