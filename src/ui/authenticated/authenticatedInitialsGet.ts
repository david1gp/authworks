/** Derives one or two display initials from a person's name for avatar fallback rendering. */
export function authenticatedInitialsGet(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
  const first = parts[0]
  if (first === undefined) return "?"
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined
  const letters = [first, last].filter((part) => part !== undefined).map((part) => [...part][0]?.toUpperCase() ?? "")
  return letters.join("")
}
