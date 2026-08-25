import * as v from "valibot"

export const whatsappOtpRequestedEventPayloadSchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1)),
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  purpose: v.picklist(["sign_in", "account_phone_change"]),
})

export type WhatsappOtpRequestedEventPayload = v.InferOutput<typeof whatsappOtpRequestedEventPayloadSchema>
