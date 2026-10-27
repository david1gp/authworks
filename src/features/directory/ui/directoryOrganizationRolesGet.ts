import type { OrganizationRoleId } from "../../organizations/public/organizationRoleIdSchema.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"

/**
 * Roles of a directory entry inside one organization, deduplicated in first-seen order.
 * The organization-scoped users list carries every membership of each person for realm
 * administrators, so callers must not flatten roles across organizations.
 */
export function directoryOrganizationRolesGet(
  entry: DirectoryEntry,
  organizationId: string,
): readonly OrganizationRoleId[] {
  const roles: OrganizationRoleId[] = []
  for (const membership of entry.memberships) {
    if (membership.organizationId !== organizationId) continue
    for (const role of membership.roles) {
      if (!roles.includes(role)) roles.push(role)
    }
  }
  return roles
}
