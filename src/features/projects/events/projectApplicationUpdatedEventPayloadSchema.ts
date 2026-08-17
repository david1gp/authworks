import * as v from "valibot"

export const projectApplicationUpdatedEventPayloadSchema = v.strictObject({
  applicationId: v.string(),
  name: v.string(),
})

export type ProjectApplicationUpdatedEventPayload = v.InferOutput<typeof projectApplicationUpdatedEventPayloadSchema>
