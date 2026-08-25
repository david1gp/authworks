import * as v from "valibot"
import { organizationMembershipResourceIdSchema } from "./organizationMembershipResourceIdSchema.js"
import { organizationResourceIdSchema } from "./organizationResourceIdSchema.js"

export const organizationAccountMembershipSchema = v.strictObject({
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  id: organizationMembershipResourceIdSchema,
  organizationId: organizationResourceIdSchema,
  realmId: v.pipe(v.string(), v.minLength(1)),
  roles: v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type OrganizationAccountMembership = v.InferOutput<typeof organizationAccountMembershipSchema>
