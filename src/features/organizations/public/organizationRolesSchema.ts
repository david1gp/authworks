import * as v from "valibot"
import { organizationRoleIdSchema } from "./organizationRoleIdSchema.js"

export const organizationRolesSchema = v.pipe(v.array(organizationRoleIdSchema), v.minLength(1), v.maxLength(4))

export type OrganizationRoles = v.InferOutput<typeof organizationRolesSchema>
