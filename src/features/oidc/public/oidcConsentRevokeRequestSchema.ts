import * as v from "valibot"
import { oidcResourceIdSchema } from "../domain/oidcResourceIdSchema.js"

export const oidcConsentRevokeRequestSchema = v.strictObject({
  client_id: oidcResourceIdSchema,
})

export type OidcConsentRevokeRequest = v.InferOutput<typeof oidcConsentRevokeRequestSchema>
