import type { ProductionShellAccess } from "../../../ui/production/productionShellAccessResolve.js"

/**
 * Resolves the post-sign-in default destination from resolved shell access. Realm
 * administrators land on the realm overview; organization owners/admins land on the
 * users page of the given organization slug; everyone else keeps the account default.
 * An explicit `return_to` always wins and is applied by the caller before this resolver runs.
 */
export function loginDefaultDestinationResolve(
  access: ProductionShellAccess,
  organizationSlug?: string,
): "/account" | "/realm" | `/orgs/${string}/users` {
  if (access.realmAdministrator) return "/realm"
  if (access.organizationRoles.includes("owner") || access.organizationRoles.includes("admin")) {
    if (organizationSlug !== undefined && organizationSlug.length > 0) return `/orgs/${organizationSlug}/users`
  }
  return "/account"
}
