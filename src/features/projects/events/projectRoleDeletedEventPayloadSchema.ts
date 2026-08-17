import * as v from "valibot"

export const projectRoleDeletedEventPayloadSchema = v.strictObject({
  key: v.string(),
  projectId: v.string(),
  roleId: v.string(),
})

export type ProjectRoleDeletedEventPayload = v.InferOutput<typeof projectRoleDeletedEventPayloadSchema>
