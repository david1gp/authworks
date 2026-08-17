import * as v from "valibot"

export const projectDeletedEventPayloadSchema = v.strictObject({ projectId: v.string() })

export type ProjectDeletedEventPayload = v.InferOutput<typeof projectDeletedEventPayloadSchema>
