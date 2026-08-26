import * as v from "valibot"
import { sessionAssuranceSchema } from "./sessionAssuranceSchema.js"

export const sessionAssuranceRequiredDetailsSchema = v.strictObject({
  action: v.literal("step_up"),
  organizationId: v.nullable(v.pipe(v.string(), v.minLength(1))),
  requiredAssurance: sessionAssuranceSchema,
})

export type SessionAssuranceRequiredDetails = v.InferOutput<typeof sessionAssuranceRequiredDetailsSchema>
