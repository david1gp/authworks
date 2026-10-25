import type { OrganizationRoleId } from "../../organizations/public/organizationRoleIdSchema.js"

const directoryRoleLabelKeys = {
  admin: "admin.users.directoryRoleAdmin",
  guest: "admin.users.directoryRoleGuest",
  member: "admin.users.directoryRoleMember",
  owner: "admin.users.directoryRoleOwner",
} as const satisfies Record<OrganizationRoleId, string>

/** Catalog key of the human-readable label for an organization role id. */
export function directoryRoleLabelKeyGet(role: OrganizationRoleId) {
  return directoryRoleLabelKeys[role]
}
