import * as v from "valibot"

export const projectRoleUpdatedEventPayloadSchema = v.strictObject({
  displayName: v.string(),
  group: v.optional(v.string()),
  key: v.string(),
  projectId: v.string(),
  roleId: v.string(),
})

export type ProjectRoleUpdatedEventPayload = v.InferOutput<typeof projectRoleUpdatedEventPayloadSchema>
