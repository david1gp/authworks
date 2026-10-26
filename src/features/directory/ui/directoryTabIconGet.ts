import { authenticatedIconRegistry } from "../../../ui/authenticated/authenticatedIconRegistry.js"
import type { DirectoryAdminTab } from "./directoryAdminTabSchema.js"

/** Zentral tab icon: People, Service accounts, and Pending invitations share one mapping everywhere. */
export function directoryTabIconGet(tab: DirectoryAdminTab): string {
  if (tab === "service-accounts") return authenticatedIconRegistry.directoryTabServiceAccounts
  if (tab === "invitations") return authenticatedIconRegistry.directoryTabInvitations
  return authenticatedIconRegistry.directoryTabPeople
}
