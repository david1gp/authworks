import * as v from "valibot"

export const organizationInvitationMeInspectRequestSchema = v.strictObject({
  token: v.pipe(v.string(), v.minLength(1)),
})

export type OrganizationInvitationMeInspectRequest = v.InferOutput<typeof organizationInvitationMeInspectRequestSchema>
