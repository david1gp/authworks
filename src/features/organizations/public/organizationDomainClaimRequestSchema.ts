import * as v from "valibot"

export const organizationDomainClaimRequestSchema = v.strictObject({
  domain: v.pipe(v.string(), v.minLength(1), v.maxLength(253)),
  isPrimary: v.optional(v.boolean()),
})

export type OrganizationDomainClaimRequest = v.InferOutput<typeof organizationDomainClaimRequestSchema>
