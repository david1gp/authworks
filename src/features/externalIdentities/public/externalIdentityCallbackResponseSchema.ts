import * as v from "valibot"
import { mfaChallengeResponseSchema } from "../../mfa/public/mfaChallengeResponseSchema.js"
import { sessionCredentialResponseSchema } from "../../sessions/public/sessionCredentialResponseSchema.js"
import { externalIdentitySchema } from "./externalIdentitySchema.js"

export const externalIdentityCallbackResponseSchema = v.variant("kind", [
  v.strictObject({
    authentication: v.strictObject({
      authenticatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
      realmId: v.pipe(v.string(), v.minLength(1)),
      userId: v.pipe(v.string(), v.minLength(1)),
    }),
    challenge: v.optional(mfaChallengeResponseSchema),
    identity: externalIdentitySchema,
    kind: v.literal("authenticated"),
    session: v.optional(sessionCredentialResponseSchema),
  }),
  v.strictObject({
    confirmationToken: v.pipe(v.string(), v.minLength(1)),
    expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
    kind: v.literal("link_confirmation"),
  }),
])

export type ExternalIdentityCallbackResponse = v.InferOutput<typeof externalIdentityCallbackResponseSchema>
