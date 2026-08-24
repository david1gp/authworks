import * as v from "valibot"

export const whatsappOtpVerifiedEventPayloadSchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1)),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type WhatsappOtpVerifiedEventPayload = v.InferOutput<typeof whatsappOtpVerifiedEventPayloadSchema>
