import type { OrganizationRole } from "../organizations/public/organizationRoleSchema.js"

/** The fixed Authworks organization roles; the set itself is read-only. */
export const demoAdminOrganizationRoles: OrganizationRole[] = [
  { id: "owner", name: "Owner" },
  { id: "admin", name: "Administrator" },
  { id: "member", name: "Member" },
  { id: "guest", name: "Guest" },
] satisfies OrganizationRole[]
