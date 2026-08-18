import * as v from "valibot"
import { oidcResourceIdSchema } from "../public/oidcResourceIdSchema.js"

export const oidcAccessTokenRevokedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  sessionId: oidcResourceIdSchema,
  userId: oidcResourceIdSchema,
})

export type OidcAccessTokenRevokedEventPayload = v.InferOutput<typeof oidcAccessTokenRevokedEventPayloadSchema>
