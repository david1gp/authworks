import type { LoginRecentAccount } from "./loginRecentAccountSchema.js"

/** Returns the primary method used by the most recently used remembered account. */
export function loginRecentAccountLastUsedMethodGet(
  accounts: readonly LoginRecentAccount[],
): LoginRecentAccount["authenticationMethod"] | undefined {
  const account = accounts.reduce<LoginRecentAccount | undefined>(
    (latest, candidate) => (latest === undefined || candidate.lastUsedAt > latest.lastUsedAt ? candidate : latest),
    undefined,
  )
  return account?.authenticationMethod
}
