import * as v from "valibot"
import { oidcResourceIdSchema } from "../domain/oidcResourceIdSchema.js"

export const oidcConsentRevokedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  userId: oidcResourceIdSchema,
})

export type OidcConsentRevokedEventPayload = v.InferOutput<typeof oidcConsentRevokedEventPayloadSchema>
