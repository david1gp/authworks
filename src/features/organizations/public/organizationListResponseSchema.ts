import type * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { organizationSchema } from "./organizationSchema.js"

export const organizationListResponseSchema = listResponseSchemaCreate(organizationSchema)

export type OrganizationListResponse = v.InferOutput<typeof organizationListResponseSchema>
