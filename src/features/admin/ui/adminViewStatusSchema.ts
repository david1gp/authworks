import * as v from "valibot"

export const adminViewStatusSchema = v.picklist([
  "loading",
  "ready",
  "empty",
  "error",
  "permission-denied",
  "expired",
  "deleted",
  "signed-in",
  "signed-out",
])

export type AdminViewStatus = v.InferOutput<typeof adminViewStatusSchema>
