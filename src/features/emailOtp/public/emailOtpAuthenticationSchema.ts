import * as v from "valibot"

export const emailOtpAuthenticationSchema = v.strictObject({
  authenticatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  realmId: v.pipe(v.string(), v.minLength(1)),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type EmailOtpAuthentication = v.InferOutput<typeof emailOtpAuthenticationSchema>
