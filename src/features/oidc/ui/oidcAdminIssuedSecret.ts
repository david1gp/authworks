/**
 * A client secret shown exactly once. It is held in view memory only and is never
 * persisted, logged, placed in a URL, or re-fetchable after acknowledgement.
 */
export type OidcAdminIssuedSecret = {
  readonly clientId: string
  readonly clientName: string
  readonly kind: "created" | "rotated"
  readonly secret: string
}
