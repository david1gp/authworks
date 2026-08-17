import * as v from "valibot"
import { organizationInvitationSchema } from "./organizationInvitationSchema.js"

export const organizationInvitationListResponseSchema = v.strictObject({
  invitations: v.array(organizationInvitationSchema),
})

export type OrganizationInvitationListResponse = v.InferOutput<typeof organizationInvitationListResponseSchema>
