import * as v from "valibot"

export const organizationAdminScreenSchema = v.picklist([
  "organizations",
  "organization-detail",
  "memberships",
  "invitations",
  "domains",
  "branding",
  "login-policy",
])

export type OrganizationAdminScreen = v.InferOutput<typeof organizationAdminScreenSchema>
