import * as v from "valibot"
import { realmResourceIdSchema } from "../../realms/public/realmResourceIdSchema.js"
import { organizationMembershipResourceIdSchema } from "./organizationMembershipResourceIdSchema.js"
import { organizationResourceIdSchema } from "./organizationResourceIdSchema.js"
import { organizationRolesSchema } from "./organizationRolesSchema.js"

export const organizationMembershipSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  id: organizationMembershipResourceIdSchema,
  realmId: realmResourceIdSchema,
  organizationId: organizationResourceIdSchema,
  roles: organizationRolesSchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type OrganizationMembership = v.InferOutput<typeof organizationMembershipSchema>
