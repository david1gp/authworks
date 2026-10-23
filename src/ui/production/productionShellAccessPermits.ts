import type { ProductionRouteGuardRequirement } from "./productionRouteGuardRequirement.js"
import type { ProductionShellAccess } from "./productionShellAccessResolve.js"

/** Realm administrators pass every access gate; organization-admin also passes for org owners/admins. */
export function productionShellAccessPermits(
  requirement: ProductionRouteGuardRequirement["access"],
  access: ProductionShellAccess,
): boolean {
  if (requirement === undefined || requirement === null) return true
  if (access.realmAdministrator) return true
  if (requirement === "organization-admin")
    return access.organizationRoles.includes("owner") || access.organizationRoles.includes("admin")
  return false
}
