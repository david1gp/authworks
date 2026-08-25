import * as v from "valibot"
import { userResourceIdSchema } from "../../users/public/userResourceIdSchema.js"
import { oidcResourceIdSchema } from "../public/oidcResourceIdSchema.js"

export const oidcConsentRevokedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  userId: userResourceIdSchema,
})

export type OidcConsentRevokedEventPayload = v.InferOutput<typeof oidcConsentRevokedEventPayloadSchema>
