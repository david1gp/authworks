import * as v from "valibot"
import { userResourceIdSchema } from "../../users/public/userResourceIdSchema.js"
import { oidcResourceIdSchema } from "../public/oidcResourceIdSchema.js"
import { oidcScopeSchema } from "../public/oidcScopeSchema.js"

export const oidcRefreshTokenIssuedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  familyId: oidcResourceIdSchema,
  scope: v.pipe(v.array(oidcScopeSchema), v.minLength(1)),
  sessionId: oidcResourceIdSchema,
  userId: userResourceIdSchema,
})

export type OidcRefreshTokenIssuedEventPayload = v.InferOutput<typeof oidcRefreshTokenIssuedEventPayloadSchema>
