import * as v from "valibot"

export const projectGrantCreatedEventPayloadSchema = v.strictObject({
  grantedOrganizationId: v.string(),
  grantId: v.string(),
  projectId: v.string(),
  roleKeys: v.array(v.string()),
})

export type ProjectGrantCreatedEventPayload = v.InferOutput<typeof projectGrantCreatedEventPayloadSchema>
