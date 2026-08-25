import * as v from "valibot"
import { userResourceIdSchema } from "../../users/public/userResourceIdSchema.js"
import { oidcResourceIdSchema } from "../public/oidcResourceIdSchema.js"
import { oidcScopeSchema } from "../public/oidcScopeSchema.js"

export const oidcRefreshTokenRotatedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  familyId: oidcResourceIdSchema,
  scope: v.pipe(v.array(oidcScopeSchema), v.minLength(1)),
  sessionId: oidcResourceIdSchema,
  userId: userResourceIdSchema,
})

export type OidcRefreshTokenRotatedEventPayload = v.InferOutput<typeof oidcRefreshTokenRotatedEventPayloadSchema>
