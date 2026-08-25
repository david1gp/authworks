import * as v from "valibot"

export const userEmailAddressAddStartResponseSchema = v.strictObject({
  accepted: v.literal(true),
  challengeId: v.pipe(v.string(), v.minLength(1)),
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  retryAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type UserEmailAddressAddStartResponse = v.InferOutput<typeof userEmailAddressAddStartResponseSchema>
