import * as v from "valibot"

export const userPhoneNumberChangedEventPayloadSchema = v.strictObject({
  verified: v.literal(true),
})

export type UserPhoneNumberChangedEventPayload = v.InferOutput<typeof userPhoneNumberChangedEventPayloadSchema>
