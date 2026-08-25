import * as v from "valibot"

export const userEmailAddressVerificationFailedEventPayloadSchema = v.strictObject({
  reason: v.picklist(["expired", "invalid_token"]),
})

export type UserEmailAddressVerificationFailedEventPayload = v.InferOutput<
  typeof userEmailAddressVerificationFailedEventPayloadSchema
>
