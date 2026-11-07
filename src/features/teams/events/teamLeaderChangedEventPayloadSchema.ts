import * as v from "valibot"

export const teamLeaderChangedEventPayloadSchema = v.strictObject({
  leaderUserId: v.string(),
  previousLeaderUserId: v.string(),
  teamId: v.string(),
})

export type TeamLeaderChangedEventPayload = v.InferOutput<typeof teamLeaderChangedEventPayloadSchema>
