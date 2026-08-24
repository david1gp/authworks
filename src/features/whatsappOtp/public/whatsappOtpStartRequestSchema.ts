import * as v from "valibot"

export const whatsappOtpStartRequestSchema = v.strictObject({
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  phoneNumber: v.pipe(v.string(), v.minLength(3), v.maxLength(16)),
})

export type WhatsappOtpStartRequest = v.InferOutput<typeof whatsappOtpStartRequestSchema>
