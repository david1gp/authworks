/**
 * Resolves the tab a keyboard event moves to in a horizontal tab list, following the WAI-ARIA
 * pattern: arrows wrap around, Home/End jump to the edges, and any other key is ignored.
 */
export function accountOrganizationTabIndexResolve(options: {
  readonly count: number
  readonly index: number
  readonly key: string
}): number | undefined {
  if (options.count <= 0) return undefined
  if (options.key === "Home") return 0
  if (options.key === "End") return options.count - 1
  if (options.key === "ArrowLeft" || options.key === "ArrowUp")
    return (options.index - 1 + options.count) % options.count
  if (options.key === "ArrowRight" || options.key === "ArrowDown") return (options.index + 1) % options.count
  return undefined
}
