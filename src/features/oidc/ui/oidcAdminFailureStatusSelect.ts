import type { OidcAdminStatus } from "./oidcAdminStatusSchema.js"

type OidcAdminFailure = { readonly code?: string; readonly statusCode?: number }

/**
 * Maps a coded API failure onto the administration status a page should present so
 * permission, assurance, and tenant boundaries never render as a generic error.
 */
export function oidcAdminFailureStatusSelect(failure: OidcAdminFailure): OidcAdminStatus {
  // The server signals a step-up requirement through the authorization catalog.
  if (failure.code === "authorization.insufficient-assurance" || failure.code === "sessions.assurance-required")
    return "assurance-required"
  if (failure.code === "oidc.tenant-mismatch") return "cross-tenant"
  if (failure.code === "oidc.forbidden" || failure.statusCode === 401 || failure.statusCode === 403)
    return "permission-denied"
  return "error"
}
