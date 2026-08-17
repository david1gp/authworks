import * as v from "valibot"
import { organizationMembershipSchema } from "./organizationMembershipSchema.js"

export const organizationMembershipResponseSchema = v.strictObject({ membership: organizationMembershipSchema })

export type OrganizationMembershipResponse = v.InferOutput<typeof organizationMembershipResponseSchema>
