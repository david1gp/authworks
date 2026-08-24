import * as v from "valibot"
import { userRegistrationVerificationMethodSchema } from "../../users/public/userRegistrationVerificationMethodSchema.js"
import { userProfileSchema } from "../../users/public/userProfileSchema.js"

export const passwordRegistrationRequestSchema = v.pipe(
  v.strictObject({
    email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
    organizationId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
    password: v.pipe(v.string(), v.minLength(1), v.maxLength(1024)),
    phoneNumber: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(32))),
    profile: userProfileSchema,
    userName: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
    verificationMethod: v.optional(userRegistrationVerificationMethodSchema),
  }),
  v.check(
    (input) => input.verificationMethod !== "whatsapp" || input.phoneNumber !== undefined,
    "A WhatsApp registration requires a phone number.",
  ),
)

export type PasswordRegistrationRequest = v.InferOutput<typeof passwordRegistrationRequestSchema>
