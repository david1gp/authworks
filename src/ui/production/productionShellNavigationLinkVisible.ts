import type { ProductionRouteGuardContext } from "./productionRouteGuardContext.js"
import { productionShellAccessPermits } from "./productionShellAccessPermits.js"

export function productionShellNavigationLinkVisible(options: {
  readonly guard: ProductionRouteGuardContext
  readonly kind: "account" | "admin" | "invitations"
  readonly target: "account" | "admin"
}): boolean {
  if (options.target === "account") return options.kind === "admin"
  if (options.guard.access === "loading") return true
  return (
    options.kind === "account" &&
    typeof options.guard.authentication === "object" &&
    typeof options.guard.realm === "object" &&
    productionShellAccessPermits("organization-admin", options.guard.access)
  )
}
