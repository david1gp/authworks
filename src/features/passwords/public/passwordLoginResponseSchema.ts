import * as v from "valibot"
import { sessionCredentialResponseSchema } from "../../sessions/public/sessionCredentialResponseSchema.js"
import { passwordAuthenticationSchema } from "./passwordAuthenticationSchema.js"

export const passwordLoginResponseSchema = v.strictObject({
  authentication: passwordAuthenticationSchema,
  session: v.optional(sessionCredentialResponseSchema),
})

export type PasswordLoginResponse = v.InferOutput<typeof passwordLoginResponseSchema>
