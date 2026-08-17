import * as v from "valibot"

export const projectRoleCreatedEventPayloadSchema = v.strictObject({
  displayName: v.string(),
  group: v.optional(v.string()),
  key: v.string(),
  projectId: v.string(),
  roleId: v.string(),
})

export type ProjectRoleCreatedEventPayload = v.InferOutput<typeof projectRoleCreatedEventPayloadSchema>
