import { authenticatedIconRegistry } from "../../../ui/authenticated/authenticatedIconRegistry.js"
import type { OrganizationRoleId } from "../../organizations/public/organizationRoleIdSchema.js"

/** Zentral role icon: All roles plus Owner, Admin, Member, and Guest share one mapping everywhere. */
export function directoryRoleIconGet(role: OrganizationRoleId | "all"): string {
  if (role === "all") return authenticatedIconRegistry.directoryRoleAll
  if (role === "owner") return authenticatedIconRegistry.directoryRoleOwner
  if (role === "admin") return authenticatedIconRegistry.directoryRoleAdmin
  if (role === "member") return authenticatedIconRegistry.directoryRoleMember
  return authenticatedIconRegistry.directoryRoleGuest
}
