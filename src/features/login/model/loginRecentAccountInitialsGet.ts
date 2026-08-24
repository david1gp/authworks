import type { LoginRecentAccount } from "./loginRecentAccountSchema.js"

/** Derives a compact initials fallback for a remembered account identifier. */
export function loginRecentAccountInitialsGet(account: LoginRecentAccount): string {
  const words = account.identifier.trim().split(/\s+/u).filter(Boolean)
  if (words.length > 1)
    return words
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  return (words[0] ?? "?").slice(0, 2).toUpperCase()
}
