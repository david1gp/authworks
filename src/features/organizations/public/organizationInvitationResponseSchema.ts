import * as v from "valibot"
import { organizationInvitationSchema } from "./organizationInvitationSchema.js"

export const organizationInvitationResponseSchema = v.strictObject({ invitation: organizationInvitationSchema })

export type OrganizationInvitationResponse = v.InferOutput<typeof organizationInvitationResponseSchema>
