import * as v from "valibot"

export const oidcUserInfoErrorSchema = v.strictObject({
  error: v.literal("invalid_token"),
  error_description: v.optional(v.pipe(v.string(), v.minLength(1))),
})

export type OidcUserInfoError = v.InferOutput<typeof oidcUserInfoErrorSchema>
