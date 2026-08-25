import * as v from "valibot"

export const whatsappOtpPhoneChangeVerifyRequestSchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1)),
  code: v.pipe(v.string(), v.regex(/^\d{6}$/)),
})

export type WhatsappOtpPhoneChangeVerifyRequest = v.InferOutput<typeof whatsappOtpPhoneChangeVerifyRequestSchema>
