import type { OrganizationRoleId } from "../../organizations/public/organizationRoleIdSchema.js"

const directoryRoleDescriptionKeys = {
  admin: "admin.roles.orgRole.admin.description",
  guest: "admin.roles.orgRole.guest.description",
  member: "admin.roles.orgRole.member.description",
  owner: "admin.roles.orgRole.owner.description",
} as const satisfies Record<OrganizationRoleId, string>

/** Catalog key of the one-line description for an organization role id. */
export function directoryRoleDescriptionKeyGet(role: OrganizationRoleId) {
  return directoryRoleDescriptionKeys[role]
}
