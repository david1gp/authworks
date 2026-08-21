import * as v from "valibot"

export const accountAccessStatusSchema = v.picklist([
  "loading",
  "ready",
  "empty",
  "error",
  "permission-denied",
  "expired",
  "replayed",
  "accepted",
  "declined",
])

export type AccountAccessStatus = v.InferOutput<typeof accountAccessStatusSchema>
