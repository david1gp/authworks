import * as v from "valibot"

export const passwordLoginRequestSchema = v.strictObject({
  identifier: v.pipe(v.string(), v.minLength(1), v.maxLength(320)),
  password: v.pipe(v.string(), v.minLength(1), v.maxLength(1024)),
})

export type PasswordLoginRequest = v.InferOutput<typeof passwordLoginRequestSchema>
