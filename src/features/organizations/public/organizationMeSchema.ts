import * as v from "valibot"
import { organizationMembershipSchema } from "./organizationMembershipSchema.js"
import { organizationSchema } from "./organizationSchema.js"

export const organizationMeSchema = v.strictObject({
  membership: organizationMembershipSchema,
  organization: organizationSchema,
})

export type OrganizationMe = v.InferOutput<typeof organizationMeSchema>
