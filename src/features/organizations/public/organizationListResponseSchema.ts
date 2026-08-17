import * as v from "valibot"
import { organizationSchema } from "./organizationSchema.js"

export const organizationListResponseSchema = v.strictObject({ organizations: v.array(organizationSchema) })

export type OrganizationListResponse = v.InferOutput<typeof organizationListResponseSchema>
