import * as v from "valibot"

export const mfaChallengeCompleteRequestSchema = v.strictObject({
  code: v.pipe(v.string(), v.regex(/^(\d{6}|[A-Z0-9-]{8,64})$/)),
  token: v.pipe(v.string(), v.minLength(43)),
})

export type MfaChallengeCompleteRequest = v.InferOutput<typeof mfaChallengeCompleteRequestSchema>
