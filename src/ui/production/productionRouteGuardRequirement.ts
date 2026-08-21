export type ProductionRouteGuardRequirement = {
  readonly authentication: "public" | "required"
  readonly realm: "optional" | "required"
  readonly organization: "not-required" | "optional" | "required"
  readonly permission: string | null
}
