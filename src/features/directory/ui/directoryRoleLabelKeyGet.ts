import type { MessageKey } from "../../../ui/i18n/model/messageKeySchema.js"
import type { OrganizationRoleId } from "../../organizations/public/organizationRoleIdSchema.js"

const directoryRoleLabelKeys = {
  admin: "admin.users.directoryRoleAdmin",
  guest: "admin.users.directoryRoleGuest",
  member: "admin.users.directoryRoleMember",
  owner: "admin.users.directoryRoleOwner",
} as const satisfies Record<OrganizationRoleId, MessageKey>

/** Catalog key of the human-readable label for an organization role id. Never throws: unknown roles fall back to member. */
export function directoryRoleLabelKeyGet(role: OrganizationRoleId): MessageKey {
  return ((directoryRoleLabelKeys as Record<string, MessageKey>)[role] ?? directoryRoleLabelKeys.member) as MessageKey
}
