import * as v from "valibot"

export const whatsappOtpSecurityNotificationSchema = v.strictObject({
  attempts: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  challengeId: v.pipe(v.string(), v.minLength(1)),
  kind: v.picklist(["failed", "requested", "verified"]),
  realmId: v.pipe(v.string(), v.minLength(1)),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type WhatsappOtpSecurityNotification = v.InferOutput<typeof whatsappOtpSecurityNotificationSchema>
