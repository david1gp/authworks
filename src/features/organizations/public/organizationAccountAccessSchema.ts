import * as v from "valibot"
import { organizationAccountMembershipSchema } from "./organizationAccountMembershipSchema.js"
import { organizationSchema } from "./organizationSchema.js"

export const organizationAccountAccessSchema = v.strictObject({
  membership: organizationAccountMembershipSchema,
  organization: organizationSchema,
})

export type OrganizationAccountAccess = v.InferOutput<typeof organizationAccountAccessSchema>
