import * as v from "valibot"

export const teamMemberAssignedEventPayloadSchema = v.strictObject({
  membershipId: v.string(),
  previousTeamId: v.optional(v.string()),
  teamId: v.string(),
  userId: v.string(),
})

export type TeamMemberAssignedEventPayload = v.InferOutput<typeof teamMemberAssignedEventPayloadSchema>
