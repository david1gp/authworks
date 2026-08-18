import * as v from "valibot"
import { oidcResourceIdSchema } from "../public/oidcResourceIdSchema.js"

export const oidcRefreshTokenFamilyRevokedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  familyId: oidcResourceIdSchema,
  sessionId: oidcResourceIdSchema,
  userId: oidcResourceIdSchema,
})

export type OidcRefreshTokenFamilyRevokedEventPayload = v.InferOutput<
  typeof oidcRefreshTokenFamilyRevokedEventPayloadSchema
>
