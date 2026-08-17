import * as v from "valibot"

export const projectGrantUpdatedEventPayloadSchema = v.strictObject({
  grantedOrganizationId: v.string(),
  grantId: v.string(),
  projectId: v.string(),
  roleKeys: v.array(v.string()),
})

export type ProjectGrantUpdatedEventPayload = v.InferOutput<typeof projectGrantUpdatedEventPayloadSchema>
