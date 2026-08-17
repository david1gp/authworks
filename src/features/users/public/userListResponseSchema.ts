import * as v from "valibot"
import { userSchema } from "./userSchema.js"

export const userListResponseSchema = v.strictObject({ users: v.array(userSchema) })

export type UserListResponse = v.InferOutput<typeof userListResponseSchema>
