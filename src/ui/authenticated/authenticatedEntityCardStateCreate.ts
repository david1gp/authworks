export function authenticatedEntityCardStateCreate(options: { readonly onActivate: () => (() => void) | undefined }) {
  const activate = () => options.onActivate()?.()
  return {
    activate,
    keyDown: (event: KeyboardEvent) => {
      if (event.target !== event.currentTarget) return
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        activate()
      }
    },
  }
}
