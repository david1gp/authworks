import * as v from "valibot"

export const emailOtpSecurityNotificationSchema = v.strictObject({
  attempts: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  challengeId: v.pipe(v.string(), v.minLength(1)),
  realmId: v.pipe(v.string(), v.minLength(1)),
  kind: v.picklist(["failed", "requested", "verified"]),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type EmailOtpSecurityNotification = v.InferOutput<typeof emailOtpSecurityNotificationSchema>
