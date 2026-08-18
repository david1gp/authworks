import * as v from "valibot"
import { oidcResourceIdSchema } from "../public/oidcResourceIdSchema.js"

export const oidcConsentRevokedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  userId: oidcResourceIdSchema,
})

export type OidcConsentRevokedEventPayload = v.InferOutput<typeof oidcConsentRevokedEventPayloadSchema>
