import * as v from "valibot"

export const passwordRecoveryDeliverySchema = v.strictObject({
  realmId: v.pipe(v.string(), v.minLength(1)),
  token: v.pipe(v.string(), v.minLength(32)),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type PasswordRecoveryDelivery = v.InferOutput<typeof passwordRecoveryDeliverySchema>
