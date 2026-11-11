import { messageTranslate } from "../../../ui/i18n/model/messageTranslate.js"
import type { DirectoryEntry } from "../public/directoryEntrySchema.js"
import { directoryOrganizationRolesGet } from "./directoryOrganizationRolesGet.js"
import { directoryRoleLabelKeyGet } from "./directoryRoleLabelKeyGet.js"

/**
 * Plain-text role summary for a directory user card. Organization scope renders
 * "Role, Role"; "all" scope renders one "Org: Role, Role" segment per membership.
 * Empty string when the entry carries no roles in scope.
 */
export function directoryUserCardRoleTextGet(
  entry: DirectoryEntry,
  organizationId: string,
  scope: "all" | "organization",
): string {
  if (scope === "all") {
    return entry.memberships
      .map(
        (membership) =>
          `${membership.organizationName}: ${membership.roles.map((role) => messageTranslate(directoryRoleLabelKeyGet(role))).join(", ")}`,
      )
      .join(" · ")
  }
  return directoryOrganizationRolesGet(entry, organizationId)
    .map((role) => messageTranslate(directoryRoleLabelKeyGet(role)))
    .join(", ")
}
