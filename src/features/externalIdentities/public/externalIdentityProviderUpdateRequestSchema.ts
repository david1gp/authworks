import * as v from "valibot"

export const externalIdentityProviderUpdateRequestSchema = v.strictObject({
  allowAccountCreation: v.optional(v.boolean()),
  clientId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(256))),
  clientSecret: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(4096))),
  displayName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  enabled: v.optional(v.boolean()),
  redirectUri: v.optional(v.pipe(v.string(), v.url(), v.maxLength(2048))),
  scopes: v.optional(v.pipe(v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(128))), v.maxLength(32))),
})

export type ExternalIdentityProviderUpdateRequest = v.InferOutput<typeof externalIdentityProviderUpdateRequestSchema>
