import type { ProductionShellAccess } from "./productionShellAccessResolve.js"

export type ProductionRouteGuardContext = {
  readonly access: ProductionShellAccess | "loading"
  readonly authentication: "loading" | "anonymous" | { readonly status: "authenticated"; readonly userId: string }
  readonly organization: "loading" | "missing" | { readonly status: "available"; readonly organizationId: string }
  /** Organization discovery did not establish whether a missing selection is intentional. */
  readonly organizationResolutionFailed?: boolean
  readonly realm: "loading" | "missing" | { readonly status: "available"; readonly realmId: string }
  readonly permission: "loading" | "granted" | "denied" | "not-required"
}
