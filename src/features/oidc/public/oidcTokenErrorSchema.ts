import * as v from "valibot"

export const oidcTokenErrorSchema = v.strictObject({
  error: v.picklist([
    "invalid_client",
    "invalid_grant",
    "invalid_request",
    "invalid_scope",
    "server_error",
    "unsupported_grant_type",
  ]),
  error_description: v.optional(v.pipe(v.string(), v.minLength(1))),
})

export type OidcTokenError = v.InferOutput<typeof oidcTokenErrorSchema>
