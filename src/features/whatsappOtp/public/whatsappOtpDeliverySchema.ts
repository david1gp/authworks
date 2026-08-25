import * as v from "valibot"

export const whatsappOtpDeliverySchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1)),
  code: v.pipe(v.string(), v.regex(/^\d{6}$/)),
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  phoneNumber: v.pipe(v.string(), v.regex(/^\+[1-9]\d{1,14}$/)),
  purpose: v.picklist(["sign_in", "account_phone_change"]),
  realmId: v.pipe(v.string(), v.minLength(1)),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type WhatsappOtpDelivery = v.InferOutput<typeof whatsappOtpDeliverySchema>
