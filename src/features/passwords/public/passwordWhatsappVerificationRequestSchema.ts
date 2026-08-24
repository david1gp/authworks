import * as v from "valibot"

export const passwordWhatsappVerificationRequestSchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  code: v.pipe(v.string(), v.length(6), v.regex(/^\d{6}$/)),
})

export type PasswordWhatsappVerificationRequest = v.InferOutput<typeof passwordWhatsappVerificationRequestSchema>
