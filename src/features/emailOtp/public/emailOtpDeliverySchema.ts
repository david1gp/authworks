import * as v from "valibot"

export const emailOtpDeliverySchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1)),
  code: v.pipe(v.string(), v.regex(/^\d{6}$/)),
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  instanceId: v.pipe(v.string(), v.minLength(1)),
  purpose: v.literal("sign_in"),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type EmailOtpDelivery = v.InferOutput<typeof emailOtpDeliverySchema>
