import * as v from "valibot"

export const mfaTotpEnrollmentSchema = v.strictObject({
  confirmedAt: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  id: v.pipe(v.string(), v.minLength(1)),
  label: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  status: v.picklist(["pending", "active"]),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type MfaTotpEnrollment = v.InferOutput<typeof mfaTotpEnrollmentSchema>
