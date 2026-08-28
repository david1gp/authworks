import type { AccountEffectiveAccessEntry } from "../public/accountEffectiveAccessEntrySchema.js"

/** Returns the access source of an effective-access entry, qualified by its grant when one exists. */
export function accountEffectiveAccessSourceGet(entry: AccountEffectiveAccessEntry): string {
  if (entry.grant === undefined) return entry.source
  return `${entry.source} · ${entry.grant.id}`
}
