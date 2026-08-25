import * as v from "valibot"
import { userEmailSchema } from "./userEmailSchema.js"

export const userEmailAddressAddResendRequestSchema = v.strictObject({
  challengeId: v.pipe(v.string(), v.minLength(1)),
  email: userEmailSchema,
})

export type UserEmailAddressAddResendRequest = v.InferOutput<typeof userEmailAddressAddResendRequestSchema>
