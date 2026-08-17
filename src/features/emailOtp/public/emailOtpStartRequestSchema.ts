import * as v from "valibot"

export const emailOtpStartRequestSchema = v.strictObject({
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
})

export type EmailOtpStartRequest = v.InferOutput<typeof emailOtpStartRequestSchema>
