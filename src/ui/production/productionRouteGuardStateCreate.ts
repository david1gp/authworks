import type { ProductionRouteGuardContext } from "./productionRouteGuardContext.js"
import type { ProductionRouteGuardRequirement } from "./productionRouteGuardRequirement.js"
import type { ProductionRouteGuardState } from "./productionRouteGuardState.js"

export function productionRouteGuardStateCreate(
  requirement: ProductionRouteGuardRequirement,
  context: ProductionRouteGuardContext,
): ProductionRouteGuardState {
  if (requirement.authentication === "required") {
    if (context.authentication === "loading") return { status: "loading" }
    if (context.authentication === "anonymous") return { status: "anonymous" }
  }

  if (requirement.realm === "required") {
    if (context.realm === "loading") return { status: "loading" }
    if (context.realm === "missing") return { context: "realm", status: "missing-context" }
  }

  if (requirement.organization === "required") {
    if (context.organization === "loading") return { status: "loading" }
    if (context.organization === "missing") return { context: "organization", status: "missing-context" }
  }

  if (requirement.permission !== null) {
    if (context.permission === "loading") return { status: "loading" }
    if (context.permission !== "granted") {
      return { permission: requirement.permission, status: "insufficient-permission" }
    }
  }

  return {
    organizationId: typeof context.organization === "object" ? context.organization.organizationId : undefined,
    realmId: typeof context.realm === "object" ? context.realm.realmId : undefined,
    status: "authenticated",
    userId: typeof context.authentication === "object" ? context.authentication.userId : "public",
  }
}
