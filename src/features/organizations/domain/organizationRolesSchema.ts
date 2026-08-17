import * as v from "valibot"
import { organizationRoleSchema } from "./organizationRoleSchema.js"

export const organizationRolesSchema = v.pipe(v.array(organizationRoleSchema), v.minLength(1), v.maxLength(4))

export type OrganizationRoles = v.InferOutput<typeof organizationRolesSchema>
