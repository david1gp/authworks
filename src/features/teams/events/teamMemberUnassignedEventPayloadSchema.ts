import * as v from "valibot"

export const teamMemberUnassignedEventPayloadSchema = v.strictObject({
  membershipId: v.string(),
  teamId: v.string(),
  userId: v.string(),
})

export type TeamMemberUnassignedEventPayload = v.InferOutput<typeof teamMemberUnassignedEventPayloadSchema>
