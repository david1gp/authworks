import * as v from "valibot"
import { userEmailSchema } from "./userEmailSchema.js"

export const userEmailChangeResendRequestSchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  email: userEmailSchema,
})

export type UserEmailChangeResendRequest = v.InferOutput<typeof userEmailChangeResendRequestSchema>
