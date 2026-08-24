import * as v from "valibot"

export const whatsappOtpFailedEventPayloadSchema = v.strictObject({
  attempts: v.pipe(v.number(), v.integer(), v.minValue(0)),
  exhausted: v.boolean(),
  reason: v.picklist(["authorization_failed", "expired", "invalid_code"]),
})

export type WhatsappOtpFailedEventPayload = v.InferOutput<typeof whatsappOtpFailedEventPayloadSchema>
