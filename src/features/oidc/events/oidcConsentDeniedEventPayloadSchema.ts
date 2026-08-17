import * as v from "valibot"
import { oidcResourceIdSchema } from "../domain/oidcResourceIdSchema.js"

export const oidcConsentDeniedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  sessionId: oidcResourceIdSchema,
  userId: oidcResourceIdSchema,
})

export type OidcConsentDeniedEventPayload = v.InferOutput<typeof oidcConsentDeniedEventPayloadSchema>
