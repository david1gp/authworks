import * as v from "valibot"

export const organizationDomainRemoveResponseSchema = v.strictObject({ removed: v.literal(true) })

export type OrganizationDomainRemoveResponse = v.InferOutput<typeof organizationDomainRemoveResponseSchema>
