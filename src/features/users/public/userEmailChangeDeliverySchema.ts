import * as v from "valibot"

export const userEmailChangeDeliverySchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1)),
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  realmId: v.pipe(v.string(), v.minLength(1)),
  token: v.pipe(v.string(), v.minLength(32), v.maxLength(256)),
  userId: v.pipe(v.string(), v.minLength(1)),
  userName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
})

export type UserEmailChangeDelivery = v.InferOutput<typeof userEmailChangeDeliverySchema>
