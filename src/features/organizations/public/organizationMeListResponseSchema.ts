import type * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { organizationMeSchema } from "./organizationMeSchema.js"

export const organizationMeListResponseSchema = listResponseSchemaCreate(organizationMeSchema)

export type OrganizationMeListResponse = v.InferOutput<typeof organizationMeListResponseSchema>
