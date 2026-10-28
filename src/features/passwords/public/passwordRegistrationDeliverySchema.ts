import * as v from "valibot"

export const passwordRegistrationDeliverySchema = v.strictObject({
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  returnTo: v.optional(v.string()),
  realmId: v.pipe(v.string(), v.minLength(1)),
  token: v.pipe(v.string(), v.minLength(32)),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type PasswordRegistrationDelivery = v.InferOutput<typeof passwordRegistrationDeliverySchema>
