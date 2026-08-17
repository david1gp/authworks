import * as v from "valibot"

export const organizationInvitationStatusSchema = v.picklist(["pending", "accepted", "declined", "revoked", "expired"])

export type OrganizationInvitationStatus = v.InferOutput<typeof organizationInvitationStatusSchema>
