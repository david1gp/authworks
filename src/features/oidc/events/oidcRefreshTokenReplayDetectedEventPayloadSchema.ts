import * as v from "valibot"
import { userResourceIdSchema } from "../../users/public/userResourceIdSchema.js"
import { oidcResourceIdSchema } from "../public/oidcResourceIdSchema.js"

export const oidcRefreshTokenReplayDetectedEventPayloadSchema = v.strictObject({
  clientId: oidcResourceIdSchema,
  familyId: oidcResourceIdSchema,
  userId: userResourceIdSchema,
})

export type OidcRefreshTokenReplayDetectedEventPayload = v.InferOutput<
  typeof oidcRefreshTokenReplayDetectedEventPayloadSchema
>
