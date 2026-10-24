/**
 * Deterministic avatar background/text classes derived from a seed string (usually the display
 * name). The palette only uses the shared soft status tokens plus the muted surface, so every
 * combination stays legible in light and dark mode.
 */
const avatarColorClasses = [
  "bg-accent-soft text-accent",
  "bg-danger-soft text-danger",
  "bg-success-soft text-success",
  "bg-warning-soft text-warning",
  "bg-muted text-muted-foreground",
] as const

export function authenticatedAvatarColorGet(seed: string): string {
  let hash = 2166136261
  for (const character of seed) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619)
  }
  return avatarColorClasses[Math.abs(hash) % avatarColorClasses.length] as string
}
