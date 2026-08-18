import * as v from "valibot"
import { oidcResourceIdSchema } from "../public/oidcResourceIdSchema.js"
import { oidcScopeSchema } from "../public/oidcScopeSchema.js"

export const oidcConsentGrantedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  scope: v.pipe(v.array(oidcScopeSchema), v.minLength(1)),
  sessionId: oidcResourceIdSchema,
  userId: oidcResourceIdSchema,
})

export type OidcConsentGrantedEventPayload = v.InferOutput<typeof oidcConsentGrantedEventPayloadSchema>
