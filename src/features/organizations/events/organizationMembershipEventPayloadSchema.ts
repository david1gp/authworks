import * as v from "valibot"
import { organizationRolesSchema } from "../domain/organizationRolesSchema.js"

export const organizationMembershipEventPayloadSchema = v.strictObject({
  membershipId: v.string(),
  roles: organizationRolesSchema,
  userId: v.string(),
})

export type OrganizationMembershipEventPayload = v.InferOutput<typeof organizationMembershipEventPayloadSchema>
