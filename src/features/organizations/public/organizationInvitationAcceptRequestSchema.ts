import * as v from "valibot"

export const organizationInvitationAcceptRequestSchema = v.strictObject({
  token: v.pipe(v.string(), v.minLength(1)),
  userId: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
})

export type OrganizationInvitationAcceptRequest = v.InferOutput<typeof organizationInvitationAcceptRequestSchema>
