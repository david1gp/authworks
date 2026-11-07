import * as v from "valibot"

export const organizationInvitationTeamSchema = v.strictObject({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  slug: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
})

export type OrganizationInvitationTeam = v.InferOutput<typeof organizationInvitationTeamSchema>
