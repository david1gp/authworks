import type { LoginRecentAccount } from "./loginRecentAccountSchema.js"

/** Derives compact avatar initials from a remembered account label, falling back to its identifier. */
export function loginRecentAccountInitialsGet(account: LoginRecentAccount): string {
  const words = (account.label ?? account.identifier).trim().split(/\s+/u).filter(Boolean)
  if (words.length > 1)
    return words
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase()
  return (words[0] ?? "?").slice(0, 2).toUpperCase()
}
