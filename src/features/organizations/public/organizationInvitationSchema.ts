import * as v from "valibot"
import { realmResourceIdSchema } from "../../realms/public/realmResourceIdSchema.js"
import { organizationInvitationInviterSchema } from "./organizationInvitationInviterSchema.js"
import { organizationInvitationStatusSchema } from "./organizationInvitationStatusSchema.js"
import { organizationInvitationTeamSchema } from "./organizationInvitationTeamSchema.js"
import { organizationResourceIdSchema } from "./organizationResourceIdSchema.js"
import { organizationRolesSchema } from "./organizationRolesSchema.js"

export const organizationInvitationSchema = v.strictObject({
  acceptedAt: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  createdAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  expiresAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
  id: organizationResourceIdSchema,
  invitedBy: v.nullable(organizationInvitationInviterSchema),
  realmId: realmResourceIdSchema,
  organizationId: organizationResourceIdSchema,
  roles: organizationRolesSchema,
  status: organizationInvitationStatusSchema,
  team: v.nullable(organizationInvitationTeamSchema),
  teamId: v.nullable(v.pipe(v.string(), v.minLength(1))),
  updatedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type OrganizationInvitation = v.InferOutput<typeof organizationInvitationSchema>
