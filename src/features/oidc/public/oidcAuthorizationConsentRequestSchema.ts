import * as v from "valibot"
import { oidcResourceIdSchema } from "../domain/oidcResourceIdSchema.js"

export const oidcAuthorizationConsentRequestSchema = v.strictObject({
  decision: v.picklist(["approve", "deny"]),
  request_id: oidcResourceIdSchema,
})

export type OidcAuthorizationConsentRequest = v.InferOutput<typeof oidcAuthorizationConsentRequestSchema>
