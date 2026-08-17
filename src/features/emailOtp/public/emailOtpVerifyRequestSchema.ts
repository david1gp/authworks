import * as v from "valibot"

export const emailOtpVerifyRequestSchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1)),
  code: v.pipe(v.string(), v.regex(/^\d{6}$/)),
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
})

export type EmailOtpVerifyRequest = v.InferOutput<typeof emailOtpVerifyRequestSchema>
