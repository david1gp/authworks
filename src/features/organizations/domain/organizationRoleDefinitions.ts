import type { OrganizationRole } from "./organizationRoleSchema.js"

export const organizationRoleDefinitions: readonly { id: OrganizationRole; name: string }[] = [
  { id: "owner", name: "Organization owner" },
  { id: "admin", name: "Organization administrator" },
  { id: "member", name: "Organization member" },
  { id: "guest", name: "Organization guest" },
]
