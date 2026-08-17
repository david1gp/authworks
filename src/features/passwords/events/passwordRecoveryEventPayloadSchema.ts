import * as v from "valibot"

export const passwordRecoveryEventPayloadSchema = v.strictObject({
  accepted: v.literal(true),
})

export type PasswordRecoveryEventPayload = v.InferOutput<typeof passwordRecoveryEventPayloadSchema>
