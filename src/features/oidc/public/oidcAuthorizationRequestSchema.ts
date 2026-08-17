import * as v from "valibot"
import { oidcResourceIdSchema } from "../domain/oidcResourceIdSchema.js"

export const oidcAuthorizationRequestSchema = v.strictObject({
  acr_values: v.optional(v.pipe(v.string(), v.maxLength(256))),
  client_id: oidcResourceIdSchema,
  code_challenge: v.pipe(v.string(), v.minLength(43), v.maxLength(43), v.regex(/^[A-Za-z0-9_-]+$/)),
  code_challenge_method: v.literal("S256"),
  nonce: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
  prompt: v.optional(v.literal("none")),
  redirect_uri: v.pipe(v.string(), v.minLength(1), v.maxLength(2048)),
  response_type: v.literal("code"),
  scope: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),
  state: v.pipe(v.string(), v.minLength(1), v.maxLength(2048)),
})

export type OidcAuthorizationRequest = v.InferOutput<typeof oidcAuthorizationRequestSchema>
