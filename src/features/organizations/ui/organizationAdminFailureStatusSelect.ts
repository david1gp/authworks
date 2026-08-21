import type { OrganizationAdminStatus } from "./organizationAdminStatusSchema.js"

type OrganizationAdminFailure = { readonly code?: string; readonly statusCode?: number }

/** Maps a coded API failure onto the administration status a page should present. */
export function organizationAdminFailureStatusSelect(failure: OrganizationAdminFailure): OrganizationAdminStatus {
  if (failure.code === "sessions.assurance-required" || failure.code === "organizations.assurance-required")
    return "assurance-required"
  if (failure.statusCode === 401 || failure.statusCode === 403) return "permission-denied"
  return "error"
}
