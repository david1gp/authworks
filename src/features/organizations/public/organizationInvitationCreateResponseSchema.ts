import * as v from "valibot"
import { organizationInvitationSchema } from "./organizationInvitationSchema.js"

export const organizationInvitationCreateResponseSchema = v.strictObject({
  invitation: organizationInvitationSchema,
  token: v.pipe(v.string(), v.minLength(1)),
})

export type OrganizationInvitationCreateResponse = v.InferOutput<typeof organizationInvitationCreateResponseSchema>
