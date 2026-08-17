import * as v from "valibot"

export const oidcAuthorizationConsentResponseSchema = v.strictObject({
  approved: v.boolean(),
  code: v.optional(v.pipe(v.string(), v.minLength(1))),
  error: v.optional(v.literal("access_denied")),
  expires_at: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  redirect_uri: v.pipe(v.string(), v.minLength(1), v.maxLength(2048)),
  state: v.pipe(v.string(), v.minLength(1), v.maxLength(2048)),
})

export type OidcAuthorizationConsentResponse = v.InferOutput<typeof oidcAuthorizationConsentResponseSchema>
