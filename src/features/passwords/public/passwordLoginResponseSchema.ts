import * as v from "valibot"
import { sessionCredentialResponseSchema } from "../../sessions/public/sessionCredentialResponseSchema.js"
import { passwordAuthenticationSchema } from "./passwordAuthenticationSchema.js"
import { mfaChallengeResponseSchema } from "../../mfa/public/mfaChallengeResponseSchema.js"

export const passwordLoginResponseSchema = v.strictObject({
  authentication: passwordAuthenticationSchema,
  challenge: v.optional(mfaChallengeResponseSchema),
  session: v.optional(sessionCredentialResponseSchema),
})

export type PasswordLoginResponse = v.InferOutput<typeof passwordLoginResponseSchema>
