import * as v from "valibot"

export const projectApplicationDeletedEventPayloadSchema = v.strictObject({
  applicationId: v.string(),
  projectId: v.string(),
})

export type ProjectApplicationDeletedEventPayload = v.InferOutput<typeof projectApplicationDeletedEventPayloadSchema>
