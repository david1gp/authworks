import * as v from "valibot"

export const projectCreatedEventPayloadSchema = v.strictObject({
  authorizationRequired: v.boolean(),
  name: v.string(),
  organizationId: v.string(),
  projectAccessRequired: v.boolean(),
})

export type ProjectCreatedEventPayload = v.InferOutput<typeof projectCreatedEventPayloadSchema>
