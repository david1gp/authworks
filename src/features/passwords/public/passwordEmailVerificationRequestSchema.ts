import * as v from "valibot"

export const passwordEmailVerificationRequestSchema = v.strictObject({
  token: v.pipe(v.string(), v.minLength(32), v.maxLength(256)),
})

export type PasswordEmailVerificationRequest = v.InferOutput<typeof passwordEmailVerificationRequestSchema>
