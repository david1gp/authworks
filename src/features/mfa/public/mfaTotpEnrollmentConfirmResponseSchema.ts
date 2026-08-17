import * as v from "valibot"
import { mfaTotpEnrollmentSchema } from "./mfaTotpEnrollmentSchema.js"

export const mfaTotpEnrollmentConfirmResponseSchema = v.strictObject({ enrollment: mfaTotpEnrollmentSchema })

export type MfaTotpEnrollmentConfirmResponse = v.InferOutput<typeof mfaTotpEnrollmentConfirmResponseSchema>
