import * as v from "valibot"
import { passwordAuthenticationSchema } from "./passwordAuthenticationSchema.js"

export const passwordLoginResponseSchema = v.strictObject({
  authentication: passwordAuthenticationSchema,
})

export type PasswordLoginResponse = v.InferOutput<typeof passwordLoginResponseSchema>
