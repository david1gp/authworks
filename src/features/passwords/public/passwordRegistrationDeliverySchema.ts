import * as v from "valibot"

export const passwordRegistrationDeliverySchema = v.strictObject({
  instanceId: v.pipe(v.string(), v.minLength(1)),
  token: v.pipe(v.string(), v.minLength(32)),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type PasswordRegistrationDelivery = v.InferOutput<typeof passwordRegistrationDeliverySchema>
