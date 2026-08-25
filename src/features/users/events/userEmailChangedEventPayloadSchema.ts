import * as v from "valibot"

export const userEmailChangedEventPayloadSchema = v.strictObject({
  verified: v.literal(true),
})

export type UserEmailChangedEventPayload = v.InferOutput<typeof userEmailChangedEventPayloadSchema>
