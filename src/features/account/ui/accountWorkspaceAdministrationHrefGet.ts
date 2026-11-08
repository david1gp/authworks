import type { ProductionRouteGuardContext } from "../../../ui/production/productionRouteGuardContext.js"
import { productionShellAccessPermits } from "../../../ui/production/productionShellAccessPermits.js"

/**
 * Use only resolved access for the active organization, never unrelated memberships. Realm
 * administrators continue to the realm overview; organization owners/admins continue to the
 * users page of the active organization slug.
 */
export function accountWorkspaceAdministrationHrefGet(
  guard: ProductionRouteGuardContext,
  organizations: readonly { readonly id: string; readonly slug?: string | undefined }[],
): string | undefined {
  if (typeof guard.authentication !== "object" || typeof guard.realm !== "object") return undefined
  if (guard.access === "loading") return undefined
  const organization = guard.organization
  if (typeof organization === "object") {
    if (!productionShellAccessPermits("organization-admin", guard.access)) return undefined
    const slug = organizations.find((item) => item.id === organization.organizationId)?.slug
    return slug === undefined ? undefined : `/orgs/${slug}/users`
  }
  if (!guard.access.realmAdministrator) return undefined
  return "/realm"
}
