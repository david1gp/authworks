import * as v from "valibot"
import { userProfileSchema } from "./userProfileSchema.js"

export const userCreateRequestSchema = v.strictObject({
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  profile: userProfileSchema,
  userName: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
})

export type UserCreateRequest = v.InferOutput<typeof userCreateRequestSchema>
