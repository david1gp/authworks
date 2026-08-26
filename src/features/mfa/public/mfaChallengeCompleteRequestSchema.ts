import * as v from "valibot"
import { mfaFactorSchema } from "./mfaFactorSchema.js"

export const mfaChallengeCompleteRequestSchema = v.strictObject({
  code: v.pipe(v.string(), v.regex(/^(\d{6}|[A-Z0-9-]{8,64})$/)),
  factor: v.optional(mfaFactorSchema),
  token: v.pipe(v.string(), v.minLength(43)),
})

export type MfaChallengeCompleteRequest = v.InferOutput<typeof mfaChallengeCompleteRequestSchema>
