import type { MachineAdminStatus } from "./machineAdminStatusSchema.js"

type MachineAdminFailure = { readonly code?: string; readonly statusCode?: number }

/**
 * Maps a coded API failure onto the administration status a page should present so
 * permission, assurance, and tenant boundaries never render as a generic error.
 */
export function machineAdminFailureStatusSelect(failure: MachineAdminFailure): MachineAdminStatus {
  // The server signals a step-up requirement through the authorization catalog.
  if (failure.code === "authorization.insufficient-assurance" || failure.code === "sessions.assurance-required")
    return "assurance-required"
  if (failure.code === "machine-users.tenant-mismatch") return "cross-tenant"
  if (
    failure.code === "machine-users.forbidden" ||
    failure.code === "machine-users.unauthorized" ||
    failure.statusCode === 401 ||
    failure.statusCode === 403
  )
    return "permission-denied"
  return "error"
}
