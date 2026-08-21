export type ProductionRouteGuardState =
  | { readonly status: "loading" }
  | { readonly status: "anonymous" }
  | {
      readonly status: "authenticated"
      readonly userId: string
      readonly realmId?: string
      readonly organizationId?: string
    }
  | { readonly status: "insufficient-permission"; readonly permission: string }
  | { readonly status: "missing-context"; readonly context: "realm" | "organization" }
