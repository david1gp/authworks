import * as v from "valibot"
import { organizationRolesSchema } from "./organizationRolesSchema.js"

export const organizationMembershipCreateRequestSchema = v.strictObject({
  roles: organizationRolesSchema,
  userId: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
})

export type OrganizationMembershipCreateRequest = v.InferOutput<typeof organizationMembershipCreateRequestSchema>
