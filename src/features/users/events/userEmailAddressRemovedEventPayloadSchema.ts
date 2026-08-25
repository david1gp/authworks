import * as v from "valibot"

export const userEmailAddressRemovedEventPayloadSchema = v.strictObject({ removed: v.literal(true) })

export type UserEmailAddressRemovedEventPayload = v.InferOutput<typeof userEmailAddressRemovedEventPayloadSchema>
