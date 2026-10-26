import * as v from "valibot"

// Deviation from Zitadel: Zitadel metadata events carry values. Ours carry the
// key only so stored values never leak into the append-only event log.
export const userMetadataRemovedEventPayloadSchema = v.strictObject({
  key: v.string(),
  userId: v.string(),
})

export type UserMetadataRemovedEventPayload = v.InferOutput<typeof userMetadataRemovedEventPayloadSchema>
