import * as v from "valibot"

export const projectUpdatedEventPayloadSchema = v.strictObject({
  authorizationRequired: v.boolean(),
  name: v.string(),
  projectAccessRequired: v.boolean(),
})

export type ProjectUpdatedEventPayload = v.InferOutput<typeof projectUpdatedEventPayloadSchema>
