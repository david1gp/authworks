import type { OrganizationRoleId } from "../public/organizationRoleIdSchema.js"

export const organizationRoleDefinitions: readonly { id: OrganizationRoleId; name: string }[] = [
  { id: "owner", name: "Organization owner" },
  { id: "admin", name: "Organization administrator" },
  { id: "member", name: "Organization member" },
  { id: "guest", name: "Organization guest" },
]
