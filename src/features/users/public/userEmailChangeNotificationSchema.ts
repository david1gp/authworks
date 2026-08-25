import * as v from "valibot"

export const userEmailChangeNotificationSchema = v.strictObject({
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  newEmail: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  realmId: v.pipe(v.string(), v.minLength(1)),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type UserEmailChangeNotification = v.InferOutput<typeof userEmailChangeNotificationSchema>
