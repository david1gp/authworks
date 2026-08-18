import type * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { organizationRoleSchema } from "./organizationRoleSchema.js"

export const organizationRoleListResponseSchema = listResponseSchemaCreate(organizationRoleSchema)

export type OrganizationRoleListResponse = v.InferOutput<typeof organizationRoleListResponseSchema>
