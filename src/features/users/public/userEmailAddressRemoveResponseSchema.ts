import * as v from "valibot"

export const userEmailAddressRemoveResponseSchema = v.strictObject({ removed: v.literal(true) })

export type UserEmailAddressRemoveResponse = v.InferOutput<typeof userEmailAddressRemoveResponseSchema>
