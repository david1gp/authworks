import type { ProductionRouteGuardContext } from "./productionRouteGuardContext.js"

export function productionShellNavigationLinkVisible(options: {
  readonly guard: ProductionRouteGuardContext
  readonly kind: "account" | "admin" | "invitations"
  readonly target: "account" | "admin"
}): boolean {
  if (options.target === "account") return options.kind === "admin"
  return (
    options.kind === "account" &&
    typeof options.guard.authentication === "object" &&
    typeof options.guard.realm === "object" &&
    options.guard.permission === "granted"
  )
}
