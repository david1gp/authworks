import { createSignalObject } from "#ui/utils/createSignalObject.js"

export function authenticatedSearchFieldStateCreate(options: {
  readonly onInput: (value: string) => void
  readonly value: () => string
}) {
  const focused = createSignalObject(false)
  return {
    focused,
    value: options.value,
    clearVisible: () => options.value().length > 0,
    clear: () => options.onInput(""),
    input: (event: InputEvent & { currentTarget: HTMLInputElement }) => options.onInput(event.currentTarget.value),
    focus: () => focused.set(true),
    blur: () => focused.set(false),
  }
}
