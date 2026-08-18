import * as v from "valibot"
import { oidcResourceIdSchema } from "../public/oidcResourceIdSchema.js"

export const oidcRefreshTokenReplayDetectedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  familyId: oidcResourceIdSchema,
  userId: oidcResourceIdSchema,
})

export type OidcRefreshTokenReplayDetectedEventPayload = v.InferOutput<
  typeof oidcRefreshTokenReplayDetectedEventPayloadSchema
>
