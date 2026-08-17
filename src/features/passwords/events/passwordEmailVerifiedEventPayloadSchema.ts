import * as v from "valibot"

export const passwordEmailVerifiedEventPayloadSchema = v.strictObject({
  verified: v.literal(true),
})

export type PasswordEmailVerifiedEventPayload = v.InferOutput<typeof passwordEmailVerifiedEventPayloadSchema>
