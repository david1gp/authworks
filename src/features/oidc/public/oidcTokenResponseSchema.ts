import * as v from "valibot"

export const oidcTokenResponseSchema = v.strictObject({
  access_token: v.pipe(v.string(), v.minLength(1)),
  expires_in: v.pipe(v.number(), v.integer(), v.minValue(1)),
  id_token: v.pipe(v.string(), v.minLength(1)),
  refresh_token: v.pipe(v.string(), v.minLength(1)),
  scope: v.pipe(v.string(), v.minLength(1)),
  token_type: v.literal("Bearer"),
})

export type OidcTokenResponse = v.InferOutput<typeof oidcTokenResponseSchema>
