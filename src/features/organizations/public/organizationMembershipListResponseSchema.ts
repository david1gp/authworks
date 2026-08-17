import * as v from "valibot"
import { organizationMembershipSchema } from "./organizationMembershipSchema.js"

export const organizationMembershipListResponseSchema = v.strictObject({
  memberships: v.array(organizationMembershipSchema),
})

export type OrganizationMembershipListResponse = v.InferOutput<typeof organizationMembershipListResponseSchema>
