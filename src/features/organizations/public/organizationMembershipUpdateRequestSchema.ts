import * as v from "valibot"
import { organizationRolesSchema } from "./organizationRolesSchema.js"

export const organizationMembershipUpdateRequestSchema = v.strictObject({ roles: organizationRolesSchema })

export type OrganizationMembershipUpdateRequest = v.InferOutput<typeof organizationMembershipUpdateRequestSchema>
