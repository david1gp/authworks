import type { ProductionShellAccess } from "../../../ui/production/productionShellAccessResolve.js"

/**
 * Resolves the post-sign-in default destination from resolved shell access. Organization
 * owners/admins of the active organization and realm administrators land on the admin users
 * page; everyone else keeps the account default. An explicit `return_to` always wins and is
 * applied by the caller before this resolver runs.
 */
export function loginDefaultDestinationResolve(access: ProductionShellAccess): "/account" | "/admin/users" {
  if (access.realmAdministrator) return "/admin/users"
  if (access.organizationRoles.includes("owner") || access.organizationRoles.includes("admin")) return "/admin/users"
  return "/account"
}
