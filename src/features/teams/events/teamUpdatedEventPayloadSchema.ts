import * as v from "valibot"

export const teamUpdatedEventPayloadSchema = v.strictObject({
  name: v.optional(v.string()),
  slug: v.optional(v.string()),
  teamId: v.string(),
})

export type TeamUpdatedEventPayload = v.InferOutput<typeof teamUpdatedEventPayloadSchema>
