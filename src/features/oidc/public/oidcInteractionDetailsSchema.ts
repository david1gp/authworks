import * as v from "valibot"
import { oidcResourceIdSchema } from "./oidcResourceIdSchema.js"
import { oidcScopeSchema } from "./oidcScopeSchema.js"

export const oidcInteractionDetailsSchema = v.strictObject({
  client_id: oidcResourceIdSchema,
  client_name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  realm_id: oidcResourceIdSchema,
  redirect_uri: v.pipe(v.string(), v.minLength(1), v.maxLength(2048)),
  scopes: v.pipe(v.array(oidcScopeSchema), v.minLength(1), v.maxLength(100)),
})

export type OidcInteractionDetails = v.InferOutput<typeof oidcInteractionDetailsSchema>
