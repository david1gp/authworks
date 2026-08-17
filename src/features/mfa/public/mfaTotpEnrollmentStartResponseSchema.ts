import * as v from "valibot"
import { mfaTotpEnrollmentSchema } from "./mfaTotpEnrollmentSchema.js"

export const mfaTotpEnrollmentStartResponseSchema = v.strictObject({
  enrollment: mfaTotpEnrollmentSchema,
  otpauthUri: v.pipe(v.string(), v.url()),
  secret: v.pipe(v.string(), v.minLength(16)),
})

export type MfaTotpEnrollmentStartResponse = v.InferOutput<typeof mfaTotpEnrollmentStartResponseSchema>
