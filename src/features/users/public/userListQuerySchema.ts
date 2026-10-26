import * as v from "valibot"
import { listQuerySchema } from "../../../platform/http/listQuerySchema.js"
import { userStateSchema } from "./userStateSchema.js"

export const userListQuerySchema = v.strictObject({
  ...listQuerySchema.entries,
  emailVerified: v.optional(v.boolean()),
  state: v.optional(userStateSchema),
})

export type UserListQuery = v.InferOutput<typeof userListQuerySchema>
