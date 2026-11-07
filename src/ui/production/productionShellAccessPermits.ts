import type { ProductionRouteGuardRequirement } from "./productionRouteGuardRequirement.js"
import type { ProductionShellAccess } from "./productionShellAccessResolve.js"

/**
 * Realm administrators pass every access gate; organization-admin also passes for org
 * owners/admins; organization-member passes for anyone holding an organization role, so
 * team leaders (plain members) reach the users surface while the view and the server
 * keep them scoped to their own team.
 */
export function productionShellAccessPermits(
  requirement: ProductionRouteGuardRequirement["access"],
  access: ProductionShellAccess,
): boolean {
  if (requirement === undefined || requirement === null) return true
  if (access.realmAdministrator) return true
  if (requirement === "organization-admin")
    return access.organizationRoles.includes("owner") || access.organizationRoles.includes("admin")
  if (requirement === "organization-member") return access.organizationRoles.length > 0
  return false
}
