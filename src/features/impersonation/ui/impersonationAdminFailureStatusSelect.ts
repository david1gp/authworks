import type { ImpersonationAdminStatus } from "./impersonationAdminStatusSchema.js"

type ImpersonationAdminFailure = { readonly code?: string; readonly statusCode?: number }

/**
 * Maps a coded API failure onto the status the impersonation views present, so an assurance
 * step-up, a missing permission, and a rejected nested attempt never read as a generic error.
 */
export function impersonationAdminFailureStatusSelect(failure: ImpersonationAdminFailure): ImpersonationAdminStatus {
  if (failure.code === "authorization.insufficient-assurance" || failure.code === "sessions.assurance-required")
    return "assurance-required"
  if (failure.code === "authorization.impersonation-forbidden") return "nested-rejected"
  if (
    failure.code === "authorization.forbidden" ||
    failure.code === "impersonation.forbidden" ||
    failure.code === "impersonation.unauthorized" ||
    failure.statusCode === 401 ||
    failure.statusCode === 403
  )
    return "permission-denied"
  return "error"
}
