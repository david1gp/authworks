export type ProductionRouteGuardContext = {
  readonly authentication: "loading" | "anonymous" | { readonly status: "authenticated"; readonly userId: string }
  readonly realm: "loading" | "missing" | { readonly status: "available"; readonly realmId: string }
  readonly organization: "loading" | "missing" | { readonly status: "available"; readonly organizationId: string }
  readonly permission: "loading" | "granted" | "denied" | "not-required"
}
