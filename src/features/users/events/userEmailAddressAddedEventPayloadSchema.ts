import * as v from "valibot"

export const userEmailAddressAddedEventPayloadSchema = v.strictObject({ added: v.literal(true) })

export type UserEmailAddressAddedEventPayload = v.InferOutput<typeof userEmailAddressAddedEventPayloadSchema>
