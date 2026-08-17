import * as v from "valibot"
import { oidcResourceIdSchema } from "../domain/oidcResourceIdSchema.js"
import { oidcScopeSchema } from "../domain/oidcScopeSchema.js"

export const oidcRefreshTokenRotatedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  familyId: oidcResourceIdSchema,
  scope: v.pipe(v.array(oidcScopeSchema), v.minLength(1)),
  sessionId: oidcResourceIdSchema,
  userId: oidcResourceIdSchema,
})

export type OidcRefreshTokenRotatedEventPayload = v.InferOutput<typeof oidcRefreshTokenRotatedEventPayloadSchema>
