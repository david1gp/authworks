import * as v from "valibot"

export const adminScreenSchema = v.picklist([
  "sign-in",
  "overview",
  "realm",
  "users",
  "user-detail",
  "sessions",
  "audit-events",
])

export type AdminScreen = v.InferOutput<typeof adminScreenSchema>
