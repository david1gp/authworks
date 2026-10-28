import type { ProductionRouteGuardContext } from "../../../ui/production/productionRouteGuardContext.js"
import { productionShellAccessPermits } from "../../../ui/production/productionShellAccessPermits.js"

/** Use only resolved access for the active organization, never unrelated memberships. */
export function accountWorkspaceAdministrationHrefGet(guard: ProductionRouteGuardContext): string | undefined {
  if (typeof guard.authentication !== "object" || typeof guard.realm !== "object") return undefined
  if (guard.access === "loading") return undefined
  if (!guard.access.realmAdministrator && typeof guard.organization !== "object") return undefined
  if (!productionShellAccessPermits("organization-admin", guard.access)) return undefined
  return "/admin/users"
}
