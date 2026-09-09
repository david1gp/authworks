import * as v from "valibot"
import { mfaTotpEnrollmentSchema } from "./mfaTotpEnrollmentSchema.js"

export const mfaTotpEnrollmentRenameResponseSchema = v.strictObject({ enrollment: mfaTotpEnrollmentSchema })

export type MfaTotpEnrollmentRenameResponse = v.InferOutput<typeof mfaTotpEnrollmentRenameResponseSchema>
