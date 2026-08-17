import * as v from "valibot"
import { oidcResourceIdSchema } from "../domain/oidcResourceIdSchema.js"
import { oidcScopeSchema } from "../domain/oidcScopeSchema.js"

export const oidcAccessTokenIssuedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  idTokenIssued: v.boolean(),
  refreshTokenIssued: v.boolean(),
  scope: v.pipe(v.array(oidcScopeSchema), v.minLength(1)),
  sessionId: oidcResourceIdSchema,
  userId: oidcResourceIdSchema,
})

export type OidcAccessTokenIssuedEventPayload = v.InferOutput<typeof oidcAccessTokenIssuedEventPayloadSchema>
