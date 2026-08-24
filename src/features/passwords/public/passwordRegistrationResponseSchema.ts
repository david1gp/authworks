import * as v from "valibot"
import { userRegistrationVerificationMethodSchema } from "../../users/public/userRegistrationVerificationMethodSchema.js"

export const passwordRegistrationResponseSchema = v.strictObject({
  accepted: v.literal(true),
  challengeId: v.optional(v.pipe(v.string(), v.minLength(1))),
  expiresAt: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  retryAt: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  verificationMethod: v.optional(userRegistrationVerificationMethodSchema),
  verificationRequired: v.literal(true),
})

export type PasswordRegistrationResponse = v.InferOutput<typeof passwordRegistrationResponseSchema>
