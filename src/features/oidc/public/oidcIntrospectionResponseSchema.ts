import * as v from "valibot"

const oidcIntrospectionInactiveSchema = v.strictObject({ active: v.literal(false) })

const oidcIntrospectionActiveSchema = v.strictObject({
  active: v.literal(true),
  aud: v.optional(v.string()),
  client_id: v.optional(v.string()),
  exp: v.optional(v.pipe(v.number(), v.integer())),
  iat: v.optional(v.pipe(v.number(), v.integer())),
  iss: v.optional(v.string()),
  scope: v.optional(v.string()),
  sub: v.optional(v.string()),
  token_type: v.optional(v.picklist(["access_token", "refresh_token"])),
  username: v.optional(v.string()),
})

export const oidcIntrospectionResponseSchema = v.union([oidcIntrospectionInactiveSchema, oidcIntrospectionActiveSchema])

export type OidcIntrospectionResponse = v.InferOutput<typeof oidcIntrospectionResponseSchema>
