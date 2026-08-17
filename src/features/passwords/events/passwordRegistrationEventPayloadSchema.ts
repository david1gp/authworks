import * as v from "valibot"

export const passwordRegistrationEventPayloadSchema = v.strictObject({
  verificationRequired: v.literal(true),
})

export type PasswordRegistrationEventPayload = v.InferOutput<typeof passwordRegistrationEventPayloadSchema>
