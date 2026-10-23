import * as v from "valibot"
import { directoryMembershipSchema } from "./directoryMembershipSchema.js"
import { directoryUserSchema } from "./directoryUserSchema.js"

export const directoryEntrySchema = v.strictObject({
  memberships: v.array(directoryMembershipSchema),
  user: directoryUserSchema,
})

export type DirectoryEntry = v.InferOutput<typeof directoryEntrySchema>
