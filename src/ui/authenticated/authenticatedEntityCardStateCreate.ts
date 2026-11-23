export function authenticatedEntityCardStateCreate(options: {
  readonly href: () => string | undefined
  readonly onActivate: () => (() => void) | undefined
}) {
  const callback = () => (options.href() ? undefined : options.onActivate())
  const activate = () => callback()?.()
  return {
    activate,
    keyDown: (event: KeyboardEvent) => {
      if (event.target !== event.currentTarget) return
      const onActivate = callback()
      if (onActivate !== undefined && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault()
        onActivate()
      }
    },
  }
}
