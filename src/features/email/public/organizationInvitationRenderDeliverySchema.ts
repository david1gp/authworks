import * as v from "valibot"

export const organizationInvitationRenderDeliverySchema = v.strictObject({
  email: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  entityName: v.pipe(v.string(), v.minLength(1)),
  invitedByEmail: v.pipe(v.string(), v.minLength(3), v.maxLength(320)),
  invitedByName: v.pipe(v.string(), v.minLength(1)),
  invitedName: v.pipe(v.string(), v.minLength(1)),
  url: v.pipe(v.string(), v.minLength(1)),
})

export type OrganizationInvitationRenderDelivery = v.InferOutput<typeof organizationInvitationRenderDeliverySchema>
