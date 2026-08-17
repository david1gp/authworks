import * as v from "valibot"
import { organizationContextSchema } from "./organizationContextSchema.js"
import { organizationResourceIdSchema } from "./organizationResourceIdSchema.js"
import { organizationSchema } from "./organizationSchema.js"

export const organizationSwitchResponseSchema = v.strictObject({
  activeOrganizationId: organizationResourceIdSchema,
  context: organizationContextSchema,
  organization: organizationSchema,
})

export type OrganizationSwitchResponse = v.InferOutput<typeof organizationSwitchResponseSchema>
