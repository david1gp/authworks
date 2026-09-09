import * as v from "valibot"

export const mfaTotpEnrollmentRenameRequestSchema = v.strictObject({
  label: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128)),
})

export type MfaTotpEnrollmentRenameRequest = v.InferOutput<typeof mfaTotpEnrollmentRenameRequestSchema>
