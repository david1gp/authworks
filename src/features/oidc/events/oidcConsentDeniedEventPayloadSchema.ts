import * as v from "valibot"
import { userResourceIdSchema } from "../../users/public/userResourceIdSchema.js"
import { oidcResourceIdSchema } from "../public/oidcResourceIdSchema.js"

export const oidcConsentDeniedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  sessionId: oidcResourceIdSchema,
  userId: userResourceIdSchema,
})

export type OidcConsentDeniedEventPayload = v.InferOutput<typeof oidcConsentDeniedEventPayloadSchema>
