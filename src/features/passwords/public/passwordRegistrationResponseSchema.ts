import * as v from "valibot"

export const passwordRegistrationResponseSchema = v.strictObject({
  accepted: v.literal(true),
  verificationRequired: v.literal(true),
})

export type PasswordRegistrationResponse = v.InferOutput<typeof passwordRegistrationResponseSchema>
