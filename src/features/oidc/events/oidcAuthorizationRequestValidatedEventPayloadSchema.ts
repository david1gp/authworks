import * as v from "valibot"
import { oidcResourceIdSchema } from "../public/oidcResourceIdSchema.js"
import { oidcScopeSchema } from "../public/oidcScopeSchema.js"

export const oidcAuthorizationRequestValidatedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  codeChallengeMethod: v.literal("S256"),
  nonceProvided: v.boolean(),
  redirectUri: v.pipe(v.string(), v.minLength(1), v.maxLength(2048)),
  scope: v.pipe(v.array(oidcScopeSchema), v.minLength(1)),
  sessionId: oidcResourceIdSchema,
  stateProvided: v.literal(true),
  userId: oidcResourceIdSchema,
})

export type OidcAuthorizationRequestValidatedEventPayload = v.InferOutput<
  typeof oidcAuthorizationRequestValidatedEventPayloadSchema
>
