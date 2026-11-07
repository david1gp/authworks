import * as v from "valibot"

export const teamCreatedEventPayloadSchema = v.strictObject({
  leaderUserId: v.string(),
  name: v.string(),
  slug: v.string(),
  teamId: v.string(),
})

export type TeamCreatedEventPayload = v.InferOutput<typeof teamCreatedEventPayloadSchema>
