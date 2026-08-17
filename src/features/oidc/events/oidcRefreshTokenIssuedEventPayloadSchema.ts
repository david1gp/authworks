import * as v from "valibot"
import { oidcResourceIdSchema } from "../domain/oidcResourceIdSchema.js"
import { oidcScopeSchema } from "../domain/oidcScopeSchema.js"

export const oidcRefreshTokenIssuedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  familyId: oidcResourceIdSchema,
  scope: v.pipe(v.array(oidcScopeSchema), v.minLength(1)),
  sessionId: oidcResourceIdSchema,
  userId: oidcResourceIdSchema,
})

export type OidcRefreshTokenIssuedEventPayload = v.InferOutput<typeof oidcRefreshTokenIssuedEventPayloadSchema>
