import * as v from "valibot"

export const whatsappOtpPhoneChangeResendRequestSchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1)),
})

export type WhatsappOtpPhoneChangeResendRequest = v.InferOutput<typeof whatsappOtpPhoneChangeResendRequestSchema>
