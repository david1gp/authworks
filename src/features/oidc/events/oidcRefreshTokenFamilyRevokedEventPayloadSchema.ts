import * as v from "valibot"
import { userResourceIdSchema } from "../../users/public/userResourceIdSchema.js"
import { oidcResourceIdSchema } from "../public/oidcResourceIdSchema.js"

export const oidcRefreshTokenFamilyRevokedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  familyId: oidcResourceIdSchema,
  sessionId: oidcResourceIdSchema,
  userId: userResourceIdSchema,
})

export type OidcRefreshTokenFamilyRevokedEventPayload = v.InferOutput<
  typeof oidcRefreshTokenFamilyRevokedEventPayloadSchema
>
