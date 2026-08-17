import * as v from "valibot"

export const organizationRoleSchema = v.picklist(["owner", "admin", "member", "guest"])

export type OrganizationRole = v.InferOutput<typeof organizationRoleSchema>
