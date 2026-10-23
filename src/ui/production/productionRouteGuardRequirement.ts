export type ProductionRouteAccess = "organization-admin" | "realm-admin"

export type ProductionRouteGuardRequirement = {
  readonly access?: ProductionRouteAccess | null
  readonly authentication: "public" | "required"
  readonly organization: "not-required" | "optional" | "required"
  readonly permission: string | null
  readonly realm: "optional" | "required"
}
