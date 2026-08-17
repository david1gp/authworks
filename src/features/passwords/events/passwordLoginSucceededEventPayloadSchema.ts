import * as v from "valibot"

export const passwordLoginSucceededEventPayloadSchema = v.strictObject({
  authenticated: v.literal(true),
})

export type PasswordLoginSucceededEventPayload = v.InferOutput<typeof passwordLoginSucceededEventPayloadSchema>
