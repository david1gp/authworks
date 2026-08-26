import * as v from "valibot"

export const mfaEmailOtpDeliverySchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1)),
  code: v.pipe(v.string(), v.regex(/^\d{6}$/)),
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  realmId: v.pipe(v.string(), v.minLength(1)),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type MfaEmailOtpDelivery = v.InferOutput<typeof mfaEmailOtpDeliverySchema>
