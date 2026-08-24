import * as v from "valibot"

export const wahaHealthCandidateStatusSchema = v.picklist(["unknown", "healthy", "unhealthy"])

export type WahaHealthCandidateStatus = v.InferOutput<typeof wahaHealthCandidateStatusSchema>
