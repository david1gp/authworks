import * as v from "valibot"
import { userPhoneNumberSchema } from "../../users/public/userPhoneNumberSchema.js"

export const whatsappOtpPhoneChangeStartRequestSchema = v.strictObject({
  phoneNumber: userPhoneNumberSchema,
})

export type WhatsappOtpPhoneChangeStartRequest = v.InferOutput<typeof whatsappOtpPhoneChangeStartRequestSchema>
