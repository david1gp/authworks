import * as v from "valibot"

export const projectUserAssignmentUpdatedEventPayloadSchema = v.strictObject({
  assignmentId: v.string(),
  projectId: v.string(),
  roleKeys: v.array(v.string()),
  userId: v.string(),
})

export type ProjectUserAssignmentUpdatedEventPayload = v.InferOutput<
  typeof projectUserAssignmentUpdatedEventPayloadSchema
>
