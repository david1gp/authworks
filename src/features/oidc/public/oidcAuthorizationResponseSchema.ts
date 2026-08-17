import * as v from "valibot"

export const oidcAuthorizationResponseSchema = v.strictObject({
  code: v.pipe(v.string(), v.minLength(43), v.maxLength(512)),
  expires_at: v.pipe(v.number(), v.integer(), v.minValue(0)),
  redirect_uri: v.pipe(v.string(), v.minLength(1), v.maxLength(2048)),
  state: v.pipe(v.string(), v.minLength(1), v.maxLength(2048)),
})

export type OidcAuthorizationResponse = v.InferOutput<typeof oidcAuthorizationResponseSchema>
