import type { AccountEffectiveAccessGroup } from "../public/accountEffectiveAccessGroupSchema.js"

export function accountEffectiveAccessGroupGet(
  groups: readonly AccountEffectiveAccessGroup[],
  organizationId: string | undefined,
): AccountEffectiveAccessGroup | undefined {
  if (organizationId === undefined) return undefined
  return groups.find((group) => group.organization.id === organizationId)
}
