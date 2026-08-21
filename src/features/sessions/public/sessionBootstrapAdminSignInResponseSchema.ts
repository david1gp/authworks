import * as v from "valibot"

export const sessionBootstrapAdminSignInResponseSchema = v.strictObject({
  adminId: v.pipe(v.string(), v.minLength(1)),
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  realmId: v.pipe(v.string(), v.minLength(1)),
  sessionId: v.pipe(v.string(), v.minLength(1)),
})

export type SessionBootstrapAdminSignInResponse = v.InferOutput<typeof sessionBootstrapAdminSignInResponseSchema>
