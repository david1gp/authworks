import * as v from "valibot"

export const projectUserAssignmentRemovedEventPayloadSchema = v.strictObject({
  assignmentId: v.string(),
  projectId: v.string(),
  userId: v.string(),
})

export type ProjectUserAssignmentRemovedEventPayload = v.InferOutput<
  typeof projectUserAssignmentRemovedEventPayloadSchema
>
