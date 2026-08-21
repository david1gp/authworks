import type * as v from "valibot"
import { organizationMembershipResponseSchema } from "./organizationMembershipResponseSchema.js"

export const organizationInvitationMeAcceptResponseSchema = organizationMembershipResponseSchema

export type OrganizationInvitationMeAcceptResponse = v.InferOutput<typeof organizationInvitationMeAcceptResponseSchema>
