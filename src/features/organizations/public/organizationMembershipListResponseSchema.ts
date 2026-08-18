import type * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { organizationMembershipSchema } from "./organizationMembershipSchema.js"

export const organizationMembershipListResponseSchema = listResponseSchemaCreate(organizationMembershipSchema)

export type OrganizationMembershipListResponse = v.InferOutput<typeof organizationMembershipListResponseSchema>
