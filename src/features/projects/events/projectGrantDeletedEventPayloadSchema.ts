import * as v from "valibot"

export const projectGrantDeletedEventPayloadSchema = v.strictObject({
  grantedOrganizationId: v.string(),
  grantId: v.string(),
  projectId: v.string(),
})

export type ProjectGrantDeletedEventPayload = v.InferOutput<typeof projectGrantDeletedEventPayloadSchema>
