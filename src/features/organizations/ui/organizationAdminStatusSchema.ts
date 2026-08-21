import * as v from "valibot"

export const organizationAdminStatusSchema = v.picklist([
  "loading",
  "ready",
  "empty",
  "error",
  "permission-denied",
  "assurance-required",
])

export type OrganizationAdminStatus = v.InferOutput<typeof organizationAdminStatusSchema>
