import * as v from "valibot"

export const mfaTotpEnrollmentRemoveResponseSchema = v.strictObject({ removed: v.literal(true) })

export type MfaTotpEnrollmentRemoveResponse = v.InferOutput<typeof mfaTotpEnrollmentRemoveResponseSchema>
