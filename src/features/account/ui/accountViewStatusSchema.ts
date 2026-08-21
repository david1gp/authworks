import * as v from "valibot"

export const accountViewStatusSchema = v.picklist(["loading", "ready", "error", "expired", "success"])

export type AccountViewStatus = v.InferOutput<typeof accountViewStatusSchema>
