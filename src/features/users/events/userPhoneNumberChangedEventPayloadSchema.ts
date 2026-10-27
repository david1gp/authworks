import * as v from "valibot"

export const userPhoneNumberChangedEventPayloadSchema = v.strictObject({
  verified: v.boolean(),
})

export type UserPhoneNumberChangedEventPayload = v.InferOutput<typeof userPhoneNumberChangedEventPayloadSchema>
