import * as v from "valibot"
import { organizationInvitationSchema } from "./organizationInvitationSchema.js"

export const organizationInvitationMeInspectResponseSchema = v.strictObject({
  invitation: organizationInvitationSchema,
})

export type OrganizationInvitationMeInspectResponse = v.InferOutput<
  typeof organizationInvitationMeInspectResponseSchema
>
