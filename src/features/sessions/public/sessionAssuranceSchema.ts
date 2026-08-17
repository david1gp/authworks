import * as v from "valibot"

export const sessionAssuranceSchema = v.picklist(["none", "authenticated", "multi_factor"])

export type SessionAssurance = v.InferOutput<typeof sessionAssuranceSchema>
