import * as v from "valibot"
import { oidcResourceIdSchema } from "../domain/oidcResourceIdSchema.js"
import { oidcScopeSchema } from "../domain/oidcScopeSchema.js"

export const oidcAuthorizationCodeRedeemResponseSchema = v.strictObject({
  client_id: oidcResourceIdSchema,
  realm_id: oidcResourceIdSchema,
  nonce: v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
  redirect_uri: v.pipe(v.string(), v.minLength(1), v.maxLength(2048)),
  scope: v.pipe(v.array(oidcScopeSchema), v.minLength(1)),
  session_id: oidcResourceIdSchema,
  user_id: oidcResourceIdSchema,
})

export type OidcAuthorizationCodeRedeemResponse = v.InferOutput<typeof oidcAuthorizationCodeRedeemResponseSchema>
