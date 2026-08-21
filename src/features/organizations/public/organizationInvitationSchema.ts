import * as v from "valibot"
import { organizationInvitationStatusSchema } from "./organizationInvitationStatusSchema.js"
import { organizationResourceIdSchema } from "./organizationResourceIdSchema.js"
import { organizationRolesSchema } from "./organizationRolesSchema.js"

export const organizationInvitationSchema = v.strictObject({
  acceptedAt: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  id: organizationResourceIdSchema,
  realmId: organizationResourceIdSchema,
  organizationId: organizationResourceIdSchema,
  roles: organizationRolesSchema,
  status: organizationInvitationStatusSchema,
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type OrganizationInvitation = v.InferOutput<typeof organizationInvitationSchema>
