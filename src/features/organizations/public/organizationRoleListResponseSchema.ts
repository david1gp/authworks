import * as v from "valibot"
import { organizationRoleSchema } from "./organizationRoleSchema.js"

export const organizationRoleListResponseSchema = v.strictObject({ roles: v.array(organizationRoleSchema) })

export type OrganizationRoleListResponse = v.InferOutput<typeof organizationRoleListResponseSchema>
