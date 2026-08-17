import * as v from "valibot"

export type OidcTokenResponse = {
  readonly access_token: string
  readonly expires_in: number
  readonly id_token: string
  readonly refresh_token: string
  readonly scope: string
  readonly token_type: "Bearer"
}

export const oidcTokenResponseSchema = v.strictObject({
  access_token: v.pipe(v.string(), v.minLength(1)),
  expires_in: v.pipe(v.number(), v.integer(), v.minValue(1)),
  id_token: v.optional(v.pipe(v.string(), v.minLength(1))),
  refresh_token: v.optional(v.pipe(v.string(), v.minLength(1))),
  scope: v.pipe(v.string(), v.minLength(1)),
  token_type: v.literal("Bearer"),
}) as v.GenericSchema<OidcTokenResponse>
