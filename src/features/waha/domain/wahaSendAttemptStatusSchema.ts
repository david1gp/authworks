import * as v from "valibot"

export const wahaSendAttemptStatusSchema = v.picklist(["sent", "failed", "blocked"])

export type WahaSendAttemptStatus = v.InferOutput<typeof wahaSendAttemptStatusSchema>
