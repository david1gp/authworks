/**
 * Selects the element that must receive focus for a `Tab` or `Shift+Tab` press inside the
 * confirmation dialog. Focus wraps within the supplied elements, so it can never escape the
 * dialog while a destructive action awaits a decision.
 */
export function confirmDialogFocusNextSelect<T>(options: {
  readonly active: T | undefined
  readonly elements: readonly T[]
  readonly backwards: boolean
}): T | undefined {
  const elements = options.elements
  if (elements.length === 0) return undefined
  const index = options.active === undefined ? -1 : elements.indexOf(options.active)
  if (index === -1) return options.backwards ? elements[elements.length - 1] : elements[0]
  const next = options.backwards ? index - 1 : index + 1
  return elements[(next + elements.length) % elements.length]
}
