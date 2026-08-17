import * as v from "valibot"
import { organizationDomainSchema } from "./organizationDomainSchema.js"

export const organizationDomainListResponseSchema = v.strictObject({
  domains: v.array(organizationDomainSchema),
  total: v.pipe(v.number(), v.integer(), v.minValue(0)),
})

export type OrganizationDomainListResponse = v.InferOutput<typeof organizationDomainListResponseSchema>
