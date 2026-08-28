import type { AuthenticatedStatusTone } from "./authenticatedStatusTone.js"

const toneClasses = {
  accent: "border-accent/35 bg-accent-soft text-accent",
  danger: "border-danger/35 bg-danger-soft text-danger",
  neutral: "border-line bg-muted text-muted-foreground",
  success: "border-success/35 bg-success-soft text-success",
  warning: "border-warning/35 bg-warning-soft text-warning",
} as const satisfies Record<AuthenticatedStatusTone, string>

/** Returns the token-based border, background, and text classes for a status tone. */
export function authenticatedStatusToneClassGet(tone: AuthenticatedStatusTone): string {
  return toneClasses[tone]
}
