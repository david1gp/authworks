import * as v from "valibot"
import { organizationResourceIdSchema } from "./organizationResourceIdSchema.js"

export const organizationMeSwitchRequestSchema = v.strictObject({ organizationId: organizationResourceIdSchema })

export type OrganizationMeSwitchRequest = v.InferOutput<typeof organizationMeSwitchRequestSchema>
