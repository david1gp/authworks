import * as v from "valibot"

export const passwordMeChangeRequestSchema = v.strictObject({
  currentPassword: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(1024))),
  newPassword: v.pipe(v.string(), v.minLength(1), v.maxLength(1024)),
})

export type PasswordMeChangeRequest = v.InferOutput<typeof passwordMeChangeRequestSchema>
