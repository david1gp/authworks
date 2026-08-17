import * as v from "valibot"
import { organizationResourceIdSchema } from "./organizationResourceIdSchema.js"

export const organizationSwitchRequestSchema = v.strictObject({
  organizationId: organizationResourceIdSchema,
})

export type OrganizationSwitchRequest = v.InferOutput<typeof organizationSwitchRequestSchema>
