import * as v from "valibot"

export const oidcLogoutResponseSchema = v.strictObject({
  post_logout_redirect_uri: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
  revoked: v.boolean(),
  state: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
})

export type OidcLogoutResponse = v.InferOutput<typeof oidcLogoutResponseSchema>
