import * as v from "valibot"

export const passwordChangeRequestSchema = v.strictObject({
  currentPassword: v.pipe(v.string(), v.minLength(1), v.maxLength(1024)),
  newPassword: v.pipe(v.string(), v.minLength(1), v.maxLength(1024)),
})

export type PasswordChangeRequest = v.InferOutput<typeof passwordChangeRequestSchema>
