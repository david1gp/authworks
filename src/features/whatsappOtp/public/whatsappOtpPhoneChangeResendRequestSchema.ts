import * as v from "valibot"
import { userPhoneNumberSchema } from "../../users/public/userPhoneNumberSchema.js"

export const whatsappOtpPhoneChangeResendRequestSchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1)),
  phoneNumber: userPhoneNumberSchema,
})

export type WhatsappOtpPhoneChangeResendRequest = v.InferOutput<typeof whatsappOtpPhoneChangeResendRequestSchema>
