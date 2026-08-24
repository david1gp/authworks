import * as v from "valibot"
import { userRegistrationVerificationMethodSchema } from "../../users/public/userRegistrationVerificationMethodSchema.js"

export const passwordRegistrationEventPayloadSchema = v.strictObject({
  verificationMethod: v.optional(userRegistrationVerificationMethodSchema),
  verificationRequired: v.literal(true),
})

export type PasswordRegistrationEventPayload = v.InferOutput<typeof passwordRegistrationEventPayloadSchema>
