import * as v from "valibot"
import { userResourceIdSchema } from "../../users/public/userResourceIdSchema.js"
import { oidcResourceIdSchema } from "../public/oidcResourceIdSchema.js"
import { oidcScopeSchema } from "../public/oidcScopeSchema.js"

export const oidcAccessTokenIssuedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  idTokenIssued: v.boolean(),
  refreshTokenIssued: v.boolean(),
  scope: v.pipe(v.array(oidcScopeSchema), v.minLength(1)),
  sessionId: oidcResourceIdSchema,
  userId: userResourceIdSchema,
})

export type OidcAccessTokenIssuedEventPayload = v.InferOutput<typeof oidcAccessTokenIssuedEventPayloadSchema>
