import * as v from "valibot"

export const organizationInvitationInviterSchema = v.strictObject({
  displayName: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  email: v.optional(v.pipe(v.string(), v.minLength(3), v.maxLength(320))),
  userId: v.pipe(v.string(), v.minLength(1)),
})

export type OrganizationInvitationInviter = v.InferOutput<typeof organizationInvitationInviterSchema>
