import type { AuthenticatedChipTone } from "./authenticatedChipTone.js"

const toneClasses = {
  neutral: "border-line bg-muted text-muted-foreground",
  accent: "border-accent/35 bg-accent-soft text-accent",
  success: "border-success/35 bg-success-soft text-success",
  warning: "border-warning/35 bg-warning-soft text-warning",
  danger: "border-danger/35 bg-danger-soft text-danger",
} as const satisfies Record<AuthenticatedChipTone, string>

/** Returns the token-based border, background, and text classes for a chip tone. */
export function authenticatedChipToneClassGet(tone: AuthenticatedChipTone): string {
  return toneClasses[tone]
}
