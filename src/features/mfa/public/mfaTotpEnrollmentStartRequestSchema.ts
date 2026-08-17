import * as v from "valibot"

export const mfaTotpEnrollmentStartRequestSchema = v.strictObject({
  label: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
})

export type MfaTotpEnrollmentStartRequest = v.InferOutput<typeof mfaTotpEnrollmentStartRequestSchema>
