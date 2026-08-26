import * as v from "valibot"

export const mfaEmailOtpStartRequestSchema = v.strictObject({
  token: v.pipe(v.string(), v.minLength(43)),
})

export type MfaEmailOtpStartRequest = v.InferOutput<typeof mfaEmailOtpStartRequestSchema>
