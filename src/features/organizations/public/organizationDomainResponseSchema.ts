import * as v from "valibot"
import { organizationDomainSchema } from "./organizationDomainSchema.js"

export const organizationDomainResponseSchema = v.strictObject({ domain: organizationDomainSchema })

export type OrganizationDomainResponse = v.InferOutput<typeof organizationDomainResponseSchema>
