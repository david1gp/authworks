import * as v from "valibot"
import { sessionCredentialResponseSchema } from "../../sessions/public/sessionCredentialResponseSchema.js"
import { emailOtpAuthenticationSchema } from "./emailOtpAuthenticationSchema.js"
import { mfaChallengeResponseSchema } from "../../mfa/public/mfaChallengeResponseSchema.js"

export const emailOtpVerifyResponseSchema = v.strictObject({
  authentication: emailOtpAuthenticationSchema,
  challenge: v.optional(mfaChallengeResponseSchema),
  session: v.optional(sessionCredentialResponseSchema),
})

export type EmailOtpVerifyResponse = v.InferOutput<typeof emailOtpVerifyResponseSchema>
