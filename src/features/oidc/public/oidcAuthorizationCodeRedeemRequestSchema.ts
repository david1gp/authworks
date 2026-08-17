import * as v from "valibot"
import { oidcResourceIdSchema } from "../domain/oidcResourceIdSchema.js"

export const oidcAuthorizationCodeRedeemRequestSchema = v.strictObject({
  client_id: oidcResourceIdSchema,
  client_secret: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(512))),
  code: v.pipe(v.string(), v.minLength(43), v.maxLength(512)),
  code_verifier: v.pipe(v.string(), v.minLength(43), v.maxLength(128), v.regex(/^[A-Za-z0-9._~-]+$/)),
  redirect_uri: v.pipe(v.string(), v.minLength(1), v.maxLength(2048)),
})

export type OidcAuthorizationCodeRedeemRequest = v.InferOutput<typeof oidcAuthorizationCodeRedeemRequestSchema>
