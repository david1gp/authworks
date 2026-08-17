import * as v from "valibot"

export const organizationMembershipRemoveResponseSchema = v.strictObject({ removed: v.literal(true) })

export type OrganizationMembershipRemoveResponse = v.InferOutput<typeof organizationMembershipRemoveResponseSchema>
