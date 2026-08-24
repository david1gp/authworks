import * as v from "valibot"
import { userSchema } from "../../users/public/userSchema.js"

export const passwordWhatsappVerificationResponseSchema = v.strictObject({
  user: userSchema,
})

export type PasswordWhatsappVerificationResponse = v.InferOutput<typeof passwordWhatsappVerificationResponseSchema>
