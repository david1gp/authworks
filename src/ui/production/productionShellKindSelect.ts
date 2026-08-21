import type { ProductionRouteContract } from "./productionRouteContract.js"

export function productionShellKindSelect(
  route: ProductionRouteContract,
): "account" | "admin" | "focus" | "invitations" {
  if (route.feature === "account") return "account"
  if (route.feature === "admin") return "admin"
  if (route.feature === "organizations") return "invitations"
  return "focus"
}
