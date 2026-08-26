import * as v from "valibot"
import { mfaChallengeResponseSchema } from "../../mfa/public/mfaChallengeResponseSchema.js"
import { sessionCredentialResponseSchema } from "../../sessions/public/sessionCredentialResponseSchema.js"

export const passkeyAuthenticationCompleteResponseSchema = v.strictObject({
  authentication: v.strictObject({
    authenticatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
    realmId: v.pipe(v.string(), v.minLength(1)),
    userId: v.pipe(v.string(), v.minLength(1)),
  }),
  challenge: v.optional(mfaChallengeResponseSchema),
  session: v.optional(sessionCredentialResponseSchema),
})

export type PasskeyAuthenticationCompleteResponse = v.InferOutput<typeof passkeyAuthenticationCompleteResponseSchema>
