import * as v from "valibot"
import { organizationStatusSchema } from "./organizationStatusSchema.js"

export const organizationLifecycleRequestSchema = v.strictObject({ status: organizationStatusSchema })

export type OrganizationLifecycleRequest = v.InferOutput<typeof organizationLifecycleRequestSchema>
