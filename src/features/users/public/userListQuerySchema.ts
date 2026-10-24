import * as v from "valibot"
import { listQuerySchema } from "../../../platform/http/listQuerySchema.js"

export const userListQuerySchema = v.strictObject({
  ...listQuerySchema.entries,
  state: v.optional(v.picklist(["deleted"])),
})

export type UserListQuery = v.InferOutput<typeof userListQuerySchema>
