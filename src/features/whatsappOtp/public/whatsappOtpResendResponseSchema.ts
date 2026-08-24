import * as v from "valibot"

export const whatsappOtpResendResponseSchema = v.strictObject({
  accepted: v.literal(true),
  challengeId: v.pipe(v.string(), v.minLength(1)),
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  retryAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type WhatsappOtpResendResponse = v.InferOutput<typeof whatsappOtpResendResponseSchema>
