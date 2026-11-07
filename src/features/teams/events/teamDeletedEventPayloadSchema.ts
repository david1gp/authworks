import * as v from "valibot"

export const teamDeletedEventPayloadSchema = v.strictObject({ teamId: v.string() })

export type TeamDeletedEventPayload = v.InferOutput<typeof teamDeletedEventPayloadSchema>
