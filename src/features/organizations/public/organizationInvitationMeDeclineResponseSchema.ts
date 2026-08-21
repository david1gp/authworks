import type * as v from "valibot"
import { organizationInvitationDeclineResponseSchema } from "./organizationInvitationDeclineResponseSchema.js"

export const organizationInvitationMeDeclineResponseSchema = organizationInvitationDeclineResponseSchema

export type OrganizationInvitationMeDeclineResponse = v.InferOutput<
  typeof organizationInvitationMeDeclineResponseSchema
>
