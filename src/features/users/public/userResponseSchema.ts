import * as v from "valibot"
import { userSchema } from "./userSchema.js"

export const userResponseSchema = v.strictObject({ user: userSchema })

export type UserResponse = v.InferOutput<typeof userResponseSchema>
