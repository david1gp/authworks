import * as v from "valibot"

export const userEmailAddressPrimarySetEventPayloadSchema = v.strictObject({ primary: v.literal(true) })

export type UserEmailAddressPrimarySetEventPayload = v.InferOutput<typeof userEmailAddressPrimarySetEventPayloadSchema>
