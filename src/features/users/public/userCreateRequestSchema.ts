import * as v from "valibot"
import { userCreateProfileSchema } from "./userCreateProfileSchema.js"

export const userCreateRequestSchema = v.strictObject({
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  phoneNumber: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(32))),
  profile: userCreateProfileSchema,
  userName: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
})

export type UserCreateRequest = v.InferOutput<typeof userCreateRequestSchema>
