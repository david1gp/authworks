import * as v from "valibot"

export const emailOtpStartRequestSchema = v.strictObject({
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
})

export type EmailOtpStartRequest = v.InferOutput<typeof emailOtpStartRequestSchema>
