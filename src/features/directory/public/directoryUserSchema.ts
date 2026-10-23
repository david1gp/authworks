import * as v from "valibot"
import { userStateSchema } from "../../users/public/userStateSchema.js"
import { userVerificationStateSchema } from "../../users/public/userVerificationStateSchema.js"

export const directoryUserSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  displayName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  emailVerified: v.boolean(),
  id: v.pipe(v.string(), v.minLength(1)),
  lastSignInAt: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  pictureUrl: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(2048))),
  state: userStateSchema,
  userName: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  verificationState: userVerificationStateSchema,
})

export type DirectoryUser = v.InferOutput<typeof directoryUserSchema>
