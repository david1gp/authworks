import * as v from "valibot"
import { oidcResourceIdSchema } from "./oidcResourceIdSchema.js"
import { oidcScopeSchema } from "./oidcScopeSchema.js"

export const oidcAuthorizationConsentRequiredSchema = v.strictObject({
  client_id: oidcResourceIdSchema,
  consent_required: v.literal(true),
  redirect_uri: v.pipe(v.string(), v.minLength(1), v.maxLength(2048)),
  request_id: oidcResourceIdSchema,
  scope: v.pipe(v.array(oidcScopeSchema), v.minLength(1)),
  state: v.pipe(v.string(), v.minLength(1), v.maxLength(2048)),
})

export type OidcAuthorizationConsentRequired = v.InferOutput<typeof oidcAuthorizationConsentRequiredSchema>
