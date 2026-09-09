import * as v from "valibot"
import { organizationBrandingSchema } from "./organizationBrandingSchema.js"
import { organizationMembershipSchema } from "./organizationMembershipSchema.js"
import { organizationSchema } from "./organizationSchema.js"

export const organizationMeSchema = v.strictObject({
  branding: v.optional(organizationBrandingSchema),
  membership: organizationMembershipSchema,
  organization: organizationSchema,
})

export type OrganizationMe = v.InferOutput<typeof organizationMeSchema>
