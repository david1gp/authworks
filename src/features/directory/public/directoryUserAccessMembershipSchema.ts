import * as v from "valibot"
import { directoryInvitedBySchema } from "./directoryInvitedBySchema.js"
import { directoryMembershipSchema } from "./directoryMembershipSchema.js"

export const directoryUserAccessMembershipSchema = v.strictObject({
  ...directoryMembershipSchema.entries,
  invitedBy: v.nullable(directoryInvitedBySchema),
})

export type DirectoryUserAccessMembership = v.InferOutput<typeof directoryUserAccessMembershipSchema>
