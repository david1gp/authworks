import * as v from "valibot"
import { userSchema } from "../../users/public/userSchema.js"

export const passwordEmailVerificationResponseSchema = v.strictObject({
  user: userSchema,
})

export type PasswordEmailVerificationResponse = v.InferOutput<typeof passwordEmailVerificationResponseSchema>
