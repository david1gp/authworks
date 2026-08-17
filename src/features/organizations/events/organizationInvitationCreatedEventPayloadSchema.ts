import * as v from "valibot"
import { organizationRolesSchema } from "../domain/organizationRolesSchema.js"

export const organizationInvitationCreatedEventPayloadSchema = v.strictObject({
  email: v.string(),
  expiresAt: v.number(),
  invitationId: v.string(),
  roles: organizationRolesSchema,
})

export type OrganizationInvitationCreatedEventPayload = v.InferOutput<
  typeof organizationInvitationCreatedEventPayloadSchema
>
