import * as v from "valibot"
import { mfaChallengeSchema } from "./mfaChallengeSchema.js"

export const mfaChallengeResponseSchema = v.strictObject({
  challenge: mfaChallengeSchema,
  token: v.pipe(v.string(), v.minLength(43)),
})

export type MfaChallengeResponse = v.InferOutput<typeof mfaChallengeResponseSchema>
