import * as v from "valibot"
import { userResourceIdSchema } from "../../users/public/userResourceIdSchema.js"
import { oidcResourceIdSchema } from "../public/oidcResourceIdSchema.js"

export const oidcLogoutEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  redirectRequested: v.boolean(),
  sessionId: oidcResourceIdSchema,
  userId: userResourceIdSchema,
})

export type OidcLogoutEventPayload = v.InferOutput<typeof oidcLogoutEventPayloadSchema>
