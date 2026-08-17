import * as v from "valibot"
import { userProfileSchema } from "../../users/public/userProfileSchema.js"

export const passwordRegistrationRequestSchema = v.strictObject({
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  password: v.pipe(v.string(), v.minLength(1), v.maxLength(1024)),
  profile: userProfileSchema,
  userName: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
})

export type PasswordRegistrationRequest = v.InferOutput<typeof passwordRegistrationRequestSchema>
