import * as v from "valibot"
import { directoryEntryTeamSchema } from "./directoryEntryTeamSchema.js"
import { directoryMembershipSchema } from "./directoryMembershipSchema.js"
import { directoryUserSchema } from "./directoryUserSchema.js"

export const directoryEntrySchema = v.strictObject({
  memberships: v.array(directoryMembershipSchema),
  team: v.nullable(directoryEntryTeamSchema),
  user: directoryUserSchema,
})

export type DirectoryEntry = v.InferOutput<typeof directoryEntrySchema>
