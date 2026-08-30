import * as v from "valibot"

export const mfaTotpEnrollmentRemoveRequestSchema = v.strictObject({
  enrollmentId: v.optional(v.pipe(v.string(), v.minLength(1))),
})

export type MfaTotpEnrollmentRemoveRequest = v.InferOutput<typeof mfaTotpEnrollmentRemoveRequestSchema>
