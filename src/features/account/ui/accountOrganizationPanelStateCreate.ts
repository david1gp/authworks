import type { AccountEffectiveAccessEntry } from "../public/accountEffectiveAccessEntrySchema.js"
import type { AccountEffectiveAccessGroup } from "../public/accountEffectiveAccessGroupSchema.js"

/** Derived, organization-scoped access lists for the selected-organization detail panel. */
export function accountOrganizationPanelStateCreate(inputs: {
  readonly group: () => AccountEffectiveAccessGroup | undefined
  readonly organizationId: () => string | undefined
}) {
  const entries = (): readonly AccountEffectiveAccessEntry[] => inputs.group()?.entries ?? []
  const organizationEntries = () => entries().filter((entry) => entry.project === undefined)
  const projectEntries = () => entries().filter((entry) => entry.project !== undefined)
  const organizationPermissions = () => {
    const unique = new Set<string>()
    for (const entry of organizationEntries()) for (const permission of entry.permissions) unique.add(permission)
    return [...unique].sort((left, right) => left.localeCompare(right))
  }
  return {
    empty: () => entries().length === 0,
    organizationPermissions,
    projectEntries,
    tabId: (panelId: string) => `${panelId}-tab-${inputs.organizationId() ?? ""}`,
  }
}
