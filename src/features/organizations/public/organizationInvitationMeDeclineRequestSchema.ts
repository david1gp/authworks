import * as v from "valibot"

export const organizationInvitationMeDeclineRequestSchema = v.strictObject({
  token: v.pipe(v.string(), v.minLength(1)),
})

export type OrganizationInvitationMeDeclineRequest = v.InferOutput<typeof organizationInvitationMeDeclineRequestSchema>
