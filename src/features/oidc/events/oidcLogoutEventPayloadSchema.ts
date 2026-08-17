import * as v from "valibot"
import { oidcResourceIdSchema } from "../domain/oidcResourceIdSchema.js"

export const oidcLogoutEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  redirectRequested: v.boolean(),
  sessionId: oidcResourceIdSchema,
  userId: oidcResourceIdSchema,
})

export type OidcLogoutEventPayload = v.InferOutput<typeof oidcLogoutEventPayloadSchema>
