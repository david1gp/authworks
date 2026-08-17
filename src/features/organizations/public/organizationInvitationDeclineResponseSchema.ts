import * as v from "valibot"

export const organizationInvitationDeclineResponseSchema = v.strictObject({ declined: v.literal(true) })

export type OrganizationInvitationDeclineResponse = v.InferOutput<typeof organizationInvitationDeclineResponseSchema>
