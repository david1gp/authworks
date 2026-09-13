import * as v from "valibot"

export const projectUserAssignmentCreatedEventPayloadSchema = v.strictObject({
  assignmentId: v.string(),
  projectId: v.string(),
  roleKeys: v.array(v.string()),
  userId: v.string(),
})

export type ProjectUserAssignmentCreatedEventPayload = v.InferOutput<
  typeof projectUserAssignmentCreatedEventPayloadSchema
>
