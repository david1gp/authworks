import * as v from "valibot"
import { oidcClientIdSchema } from "./oidcClientIdSchema.js"

export const oidcIntrospectionRequestSchema = v.strictObject({
  client_id: v.optional(oidcClientIdSchema),
  client_secret: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(512))),
  token: v.pipe(v.string(), v.minLength(1), v.maxLength(8192)),
  token_type_hint: v.optional(v.picklist(["access_token", "refresh_token"])),
})

export type OidcIntrospectionRequest = v.InferOutput<typeof oidcIntrospectionRequestSchema>
