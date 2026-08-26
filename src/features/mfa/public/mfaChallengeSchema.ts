import * as v from "valibot"
import { mfaFactorSchema } from "./mfaFactorSchema.js"

export const mfaChallengeSchema = v.strictObject({
  availableFactors: v.optional(v.array(mfaFactorSchema)),
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  factor: v.optional(mfaFactorSchema),
  id: v.pipe(v.string(), v.minLength(1)),
  purpose: v.picklist(["login", "step_up"]),
  requiredAssurance: v.literal("multi_factor"),
})

export type MfaChallenge = v.InferOutput<typeof mfaChallengeSchema>
