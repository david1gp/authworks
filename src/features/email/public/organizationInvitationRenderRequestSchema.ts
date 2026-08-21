import * as v from "valibot"
import { emailGeneratorFooterSchema } from "./emailGeneratorFooterSchema.js"
import { organizationInvitationRenderDeliverySchema } from "./organizationInvitationRenderDeliverySchema.js"

export const organizationInvitationRenderRequestSchema = v.strictObject({
  delivery: organizationInvitationRenderDeliverySchema,
  footer: emailGeneratorFooterSchema,
})

export type OrganizationInvitationRenderRequest = v.InferOutput<typeof organizationInvitationRenderRequestSchema>
