import * as v from "valibot"
import { organizationSchema } from "./organizationSchema.js"

export const organizationResponseSchema = v.strictObject({ organization: organizationSchema })

export type OrganizationResponse = v.InferOutput<typeof organizationResponseSchema>
