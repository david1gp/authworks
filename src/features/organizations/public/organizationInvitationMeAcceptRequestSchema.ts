import * as v from "valibot"

export const organizationInvitationMeAcceptRequestSchema = v.strictObject({
  token: v.pipe(v.string(), v.minLength(1)),
})

export type OrganizationInvitationMeAcceptRequest = v.InferOutput<typeof organizationInvitationMeAcceptRequestSchema>
