import * as v from "valibot"

export const impersonationSecurityNotificationSchema = v.strictObject({
  actorId: v.pipe(v.string(), v.minLength(1)),
  endedById: v.optional(v.pipe(v.string(), v.minLength(1))),
  realmId: v.pipe(v.string(), v.minLength(1)),
  kind: v.picklist(["started", "ended"]),
  organizationId: v.optional(v.pipe(v.string(), v.minLength(1))),
  sessionId: v.pipe(v.string(), v.minLength(1)),
  subjectId: v.pipe(v.string(), v.minLength(1)),
})

export type ImpersonationSecurityNotification = v.InferOutput<typeof impersonationSecurityNotificationSchema>
