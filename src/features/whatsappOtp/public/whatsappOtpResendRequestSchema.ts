import * as v from "valibot"

export const whatsappOtpResendRequestSchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1)),
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
})

export type WhatsappOtpResendRequest = v.InferOutput<typeof whatsappOtpResendRequestSchema>
