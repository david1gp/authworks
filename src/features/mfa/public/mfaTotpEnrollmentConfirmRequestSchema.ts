import * as v from "valibot"

export const mfaTotpEnrollmentConfirmRequestSchema = v.strictObject({
  code: v.pipe(v.string(), v.regex(/^\d{6}$/)),
  enrollmentId: v.pipe(v.string(), v.minLength(1)),
})

export type MfaTotpEnrollmentConfirmRequest = v.InferOutput<typeof mfaTotpEnrollmentConfirmRequestSchema>
