import * as v from "valibot"
import { mfaChallengeResponseSchema } from "../../mfa/public/mfaChallengeResponseSchema.js"
import { sessionCredentialResponseSchema } from "../../sessions/public/sessionCredentialResponseSchema.js"
import { whatsappOtpAuthenticationSchema } from "./whatsappOtpAuthenticationSchema.js"

export const whatsappOtpVerifyResponseSchema = v.strictObject({
  authentication: whatsappOtpAuthenticationSchema,
  challenge: v.optional(mfaChallengeResponseSchema),
  session: v.optional(sessionCredentialResponseSchema),
})

export type WhatsappOtpVerifyResponse = v.InferOutput<typeof whatsappOtpVerifyResponseSchema>
