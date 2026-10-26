import * as v from "valibot"

// Deviation from Zitadel: Zitadel metadata events carry values. Ours carry the
// key only so stored values never leak into the append-only event log.
export const userMetadataSetEventPayloadSchema = v.strictObject({
  key: v.string(),
  userId: v.string(),
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
})

export type UserMetadataSetEventPayload = v.InferOutput<typeof userMetadataSetEventPayloadSchema>
