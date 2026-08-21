import * as v from "valibot"

export const organizationInvitationDeliverySchema = v.strictObject({
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  entityName: v.pipe(v.string(), v.minLength(1)),
  invitedByEmail: v.pipe(v.string(), v.minLength(1)),
  invitedByName: v.pipe(v.string(), v.minLength(1)),
  invitedName: v.pipe(v.string(), v.minLength(1)),
  token: v.pipe(v.string(), v.minLength(1)),
})

export type OrganizationInvitationDelivery = v.InferOutput<typeof organizationInvitationDeliverySchema>
