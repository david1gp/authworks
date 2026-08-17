import * as v from "valibot"

export const organizationDomainVerifiedEventPayloadSchema = v.strictObject({
  domain: v.pipe(v.string(), v.minLength(1), v.maxLength(253)),
  verified: v.literal(true),
})

export type OrganizationDomainVerifiedEventPayload = v.InferOutput<typeof organizationDomainVerifiedEventPayloadSchema>
