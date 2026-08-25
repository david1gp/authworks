import * as v from "valibot"
import { userPhoneNumberSchema } from "../../users/public/userPhoneNumberSchema.js"

export const whatsappOtpPhoneChangeVerifyRequestSchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1)),
  code: v.pipe(v.string(), v.regex(/^\d{6}$/)),
  phoneNumber: userPhoneNumberSchema,
})

export type WhatsappOtpPhoneChangeVerifyRequest = v.InferOutput<typeof whatsappOtpPhoneChangeVerifyRequestSchema>
