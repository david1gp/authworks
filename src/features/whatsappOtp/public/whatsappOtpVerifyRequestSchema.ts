import * as v from "valibot"

export const whatsappOtpVerifyRequestSchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1)),
  code: v.pipe(v.string(), v.regex(/^\d{6}$/)),
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
})

export type WhatsappOtpVerifyRequest = v.InferOutput<typeof whatsappOtpVerifyRequestSchema>
