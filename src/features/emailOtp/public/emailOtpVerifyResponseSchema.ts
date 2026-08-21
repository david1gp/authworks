import * as v from "valibot"
import { mfaChallengeResponseSchema } from "../../mfa/public/mfaChallengeResponseSchema.js"
import { sessionCredentialResponseSchema } from "../../sessions/public/sessionCredentialResponseSchema.js"
import { emailOtpAuthenticationSchema } from "./emailOtpAuthenticationSchema.js"

export const emailOtpVerifyResponseSchema = v.strictObject({
  authentication: emailOtpAuthenticationSchema,
  challenge: v.optional(mfaChallengeResponseSchema),
  session: v.optional(sessionCredentialResponseSchema),
})

export type EmailOtpVerifyResponse = v.InferOutput<typeof emailOtpVerifyResponseSchema>
