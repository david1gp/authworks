import * as v from "valibot"

export const mfaChallengeSchema = v.strictObject({
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  id: v.pipe(v.string(), v.minLength(1)),
  purpose: v.picklist(["login", "step_up"]),
  requiredAssurance: v.literal("multi_factor"),
})

export type MfaChallenge = v.InferOutput<typeof mfaChallengeSchema>
