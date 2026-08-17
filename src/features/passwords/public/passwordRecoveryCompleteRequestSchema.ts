import * as v from "valibot"

export const passwordRecoveryCompleteRequestSchema = v.strictObject({
  newPassword: v.pipe(v.string(), v.minLength(1), v.maxLength(1024)),
  token: v.pipe(v.string(), v.minLength(32), v.maxLength(256)),
})

export type PasswordRecoveryCompleteRequest = v.InferOutput<typeof passwordRecoveryCompleteRequestSchema>
