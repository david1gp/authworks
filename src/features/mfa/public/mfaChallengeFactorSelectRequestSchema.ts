import * as v from "valibot"
import { mfaFactorSchema } from "./mfaFactorSchema.js"

export const mfaChallengeFactorSelectRequestSchema = v.strictObject({
  factor: mfaFactorSchema,
  token: v.pipe(v.string(), v.minLength(43)),
})

export type MfaChallengeFactorSelectRequest = v.InferOutput<typeof mfaChallengeFactorSelectRequestSchema>
