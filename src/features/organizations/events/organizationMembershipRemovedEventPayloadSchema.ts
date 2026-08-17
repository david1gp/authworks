import * as v from "valibot"

export const organizationMembershipRemovedEventPayloadSchema = v.strictObject({
  membershipId: v.string(),
  userId: v.string(),
})

export type OrganizationMembershipRemovedEventPayload = v.InferOutput<
  typeof organizationMembershipRemovedEventPayloadSchema
>
