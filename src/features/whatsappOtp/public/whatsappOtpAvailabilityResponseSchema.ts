import * as v from "valibot"

export const whatsappOtpAvailabilityResponseSchema = v.strictObject({
  available: v.boolean(),
})

export type WhatsappOtpAvailabilityResponse = v.InferOutput<typeof whatsappOtpAvailabilityResponseSchema>
