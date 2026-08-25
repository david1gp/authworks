import * as v from "valibot"

export const userEmailAddressVerificationRequestedEventPayloadSchema = v.strictObject({
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type UserEmailAddressVerificationRequestedEventPayload = v.InferOutput<
  typeof userEmailAddressVerificationRequestedEventPayloadSchema
>
