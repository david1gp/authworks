import * as v from "valibot"

export const userEmailAddressVerifiedEventPayloadSchema = v.strictObject({ verified: v.literal(true) })

export type UserEmailAddressVerifiedEventPayload = v.InferOutput<typeof userEmailAddressVerifiedEventPayloadSchema>
