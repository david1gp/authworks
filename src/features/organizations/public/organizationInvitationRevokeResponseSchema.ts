import * as v from "valibot"

export const organizationInvitationRevokeResponseSchema = v.strictObject({ revoked: v.literal(true) })

export type OrganizationInvitationRevokeResponse = v.InferOutput<typeof organizationInvitationRevokeResponseSchema>
