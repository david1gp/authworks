import type * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { organizationMetadataSchema } from "./organizationMetadataSchema.js"

export const organizationMetadataListResponseSchema = listResponseSchemaCreate(organizationMetadataSchema)

export type OrganizationMetadataListResponse = v.InferOutput<typeof organizationMetadataListResponseSchema>
