import * as v from "valibot"

export const impersonationAdminStatusSchema = v.picklist([
  "loading",
  "ready",
  "error",
  "permission-denied",
  "assurance-required",
  "nested-rejected",
])

export type ImpersonationAdminStatus = v.InferOutput<typeof impersonationAdminStatusSchema>
