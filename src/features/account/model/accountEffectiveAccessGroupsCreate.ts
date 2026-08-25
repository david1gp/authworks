import type { AccountEffectiveAccessEntry } from "../public/accountEffectiveAccessEntrySchema.js"
import type { AccountEffectiveAccessGroup } from "../public/accountEffectiveAccessGroupSchema.js"

export function accountEffectiveAccessGroupsCreate(
  entries: readonly AccountEffectiveAccessEntry[],
): AccountEffectiveAccessGroup[] {
  const groups = new Map<string, AccountEffectiveAccessGroup>()
  for (const entry of entries) {
    const current = groups.get(entry.organization.organization.id)
    if (current === undefined) {
      groups.set(entry.organization.organization.id, {
        entries: [entry],
        organization: entry.organization.organization,
      })
      continue
    }
    current.entries.push(entry)
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      entries: [...group.entries].sort((left, right) => left.id.localeCompare(right.id)),
    }))
    .sort((left, right) => left.organization.id.localeCompare(right.organization.id))
}
