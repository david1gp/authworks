import * as v from "valibot"

export const userEmailAddressPrimarySetRequestSchema = v.strictObject({
  expectedVersion: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
})

export type UserEmailAddressPrimarySetRequest = v.InferOutput<typeof userEmailAddressPrimarySetRequestSchema>
