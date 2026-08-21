import * as v from "valibot"

export const loginRecentAccountSchema = v.strictObject({
  authenticationMethod: v.picklist(["email_otp", "external_identity", "passkey", "password"]),
  identifier: v.pipe(v.string(), v.minLength(1), v.maxLength(320)),
  lastUsedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  sessionId: v.pipe(v.string(), v.minLength(1)),
})

export type LoginRecentAccount = v.InferOutput<typeof loginRecentAccountSchema>
