import * as v from "valibot"
import { oidcResourceIdSchema } from "../domain/oidcResourceIdSchema.js"

const oidcTokenSecretSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(512))
const oidcTokenValueSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(512))

export const oidcTokenRequestSchema = v.strictObject({
  client_id: v.optional(oidcResourceIdSchema),
  client_secret: v.optional(oidcTokenSecretSchema),
  code: v.optional(oidcTokenValueSchema),
  code_verifier: v.optional(v.pipe(v.string(), v.minLength(43), v.maxLength(128), v.regex(/^[A-Za-z0-9._~-]+$/))),
  grant_type: v.picklist(["authorization_code", "refresh_token"]),
  redirect_uri: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
  refresh_token: v.optional(oidcTokenValueSchema),
  scope: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
})

export type OidcTokenRequest = v.InferOutput<typeof oidcTokenRequestSchema>
