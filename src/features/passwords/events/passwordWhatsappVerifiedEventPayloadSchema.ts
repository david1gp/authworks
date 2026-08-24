import * as v from "valibot"

export const passwordWhatsappVerifiedEventPayloadSchema = v.strictObject({
  verified: v.literal(true),
})

export type PasswordWhatsappVerifiedEventPayload = v.InferOutput<typeof passwordWhatsappVerifiedEventPayloadSchema>
