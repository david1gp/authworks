import * as v from "valibot"
import { userPhoneNumberSchema } from "../../users/public/userPhoneNumberSchema.js"

export const passwordRegistrationWhatsappDeliverySchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1)),
  code: v.pipe(v.string(), v.length(6), v.regex(/^\d{6}$/)),
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  phoneNumber: userPhoneNumberSchema,
  realmId: v.pipe(v.string(), v.minLength(1)),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type PasswordRegistrationWhatsappDelivery = v.InferOutput<typeof passwordRegistrationWhatsappDeliverySchema>
