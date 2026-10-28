import * as v from "valibot"
import { organizationInvitationSchema } from "./organizationInvitationSchema.js"
import { organizationSchema } from "./organizationSchema.js"

export const organizationInvitationMeInspectResponseSchema = v.strictObject({
  invitation: v.strictObject({
    ...organizationInvitationSchema.entries,
    organizationName: v.optional(organizationSchema.entries.name),
  }),
})

export type OrganizationInvitationMeInspectResponse = v.InferOutput<
  typeof organizationInvitationMeInspectResponseSchema
>
