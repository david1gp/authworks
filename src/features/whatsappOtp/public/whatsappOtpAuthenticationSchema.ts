import * as v from "valibot"

export const whatsappOtpAuthenticationSchema = v.strictObject({
  authenticatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  realmId: v.pipe(v.string(), v.minLength(1)),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type WhatsappOtpAuthentication = v.InferOutput<typeof whatsappOtpAuthenticationSchema>
