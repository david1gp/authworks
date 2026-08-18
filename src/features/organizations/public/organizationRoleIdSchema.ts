import * as v from "valibot"

export const organizationRoleIdSchema = v.picklist(["owner", "admin", "member", "guest"])

export type OrganizationRoleId = v.InferOutput<typeof organizationRoleIdSchema>
