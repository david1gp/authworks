import * as v from "valibot"

export const organizationAdminScreenSchema = v.picklist([
  "organizations",
  "organization-detail",
  "configuration",
  "login-policy",
])

export type OrganizationAdminScreen = v.InferOutput<typeof organizationAdminScreenSchema>
