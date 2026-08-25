import * as v from "valibot"
import { userResourceIdSchema } from "../../users/public/userResourceIdSchema.js"
import { oidcResourceIdSchema } from "../public/oidcResourceIdSchema.js"

export const oidcAccessTokenRevokedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  sessionId: oidcResourceIdSchema,
  userId: userResourceIdSchema,
})

export type OidcAccessTokenRevokedEventPayload = v.InferOutput<typeof oidcAccessTokenRevokedEventPayloadSchema>
