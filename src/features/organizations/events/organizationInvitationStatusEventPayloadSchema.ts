import * as v from "valibot"
import { organizationInvitationStatusSchema } from "../domain/organizationInvitationStatusSchema.js"

export const organizationInvitationStatusEventPayloadSchema = v.strictObject({
  invitationId: v.string(),
  status: organizationInvitationStatusSchema,
  userId: v.optional(v.string()),
})

export type OrganizationInvitationStatusEventPayload = v.InferOutput<
  typeof organizationInvitationStatusEventPayloadSchema
>
