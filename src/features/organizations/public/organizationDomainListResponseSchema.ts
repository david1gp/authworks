import type * as v from "valibot"
import { listResponseSchemaCreate } from "../../../platform/http/listResponseSchemaCreate.js"
import { organizationDomainSchema } from "./organizationDomainSchema.js"

export const organizationDomainListResponseSchema = listResponseSchemaCreate(organizationDomainSchema)

export type OrganizationDomainListResponse = v.InferOutput<typeof organizationDomainListResponseSchema>
