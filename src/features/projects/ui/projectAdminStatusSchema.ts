import * as v from "valibot"

export const projectAdminStatusSchema = v.picklist([
  "loading",
  "ready",
  "empty",
  "error",
  "permission-denied",
  "cross-tenant",
])

export type ProjectAdminStatus = v.InferOutput<typeof projectAdminStatusSchema>
