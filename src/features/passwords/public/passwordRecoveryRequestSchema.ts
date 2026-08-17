import * as v from "valibot"

export const passwordRecoveryRequestSchema = v.strictObject({
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
})

export type PasswordRecoveryRequest = v.InferOutput<typeof passwordRecoveryRequestSchema>
