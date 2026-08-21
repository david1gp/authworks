import * as v from "valibot"

export const oidcAdminStatusSchema = v.picklist([
  "loading",
  "ready",
  "empty",
  "error",
  "permission-denied",
  "assurance-required",
  "cross-tenant",
])

export type OidcAdminStatus = v.InferOutput<typeof oidcAdminStatusSchema>
