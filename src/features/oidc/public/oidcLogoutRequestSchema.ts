import * as v from "valibot"
import { oidcResourceIdSchema } from "../domain/oidcResourceIdSchema.js"

export const oidcLogoutRequestSchema = v.strictObject({
  client_id: v.optional(oidcResourceIdSchema),
  id_token_hint: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(8192))),
  post_logout_redirect_uri: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
  state: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
})

export type OidcLogoutRequest = v.InferOutput<typeof oidcLogoutRequestSchema>
