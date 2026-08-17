import * as v from "valibot"
import { oidcResourceIdSchema } from "../domain/oidcResourceIdSchema.js"
import { oidcScopeSchema } from "../domain/oidcScopeSchema.js"

export const oidcAuthorizationCodeConsumedEventPayloadSchema = v.strictObject({
  authorizationCodeId: oidcResourceIdSchema,
  clientId: oidcResourceIdSchema,
  nonceProvided: v.boolean(),
  redirectUri: v.pipe(v.string(), v.minLength(1), v.maxLength(2048)),
  scope: v.pipe(v.array(oidcScopeSchema), v.minLength(1)),
  sessionId: oidcResourceIdSchema,
  userId: oidcResourceIdSchema,
})

export type OidcAuthorizationCodeConsumedEventPayload = v.InferOutput<
  typeof oidcAuthorizationCodeConsumedEventPayloadSchema
>
