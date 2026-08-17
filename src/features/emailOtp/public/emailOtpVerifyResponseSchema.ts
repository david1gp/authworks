import * as v from "valibot"
import { sessionCredentialResponseSchema } from "../../sessions/public/sessionCredentialResponseSchema.js"
import { emailOtpAuthenticationSchema } from "./emailOtpAuthenticationSchema.js"

export const emailOtpVerifyResponseSchema = v.strictObject({
  authentication: emailOtpAuthenticationSchema,
  session: sessionCredentialResponseSchema,
})

export type EmailOtpVerifyResponse = v.InferOutput<typeof emailOtpVerifyResponseSchema>
