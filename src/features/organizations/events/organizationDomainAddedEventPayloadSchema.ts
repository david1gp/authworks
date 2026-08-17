import * as v from "valibot"

export const organizationDomainAddedEventPayloadSchema = v.strictObject({
  domain: v.pipe(v.string(), v.minLength(1), v.maxLength(253)),
  isPrimary: v.boolean(),
  verified: v.boolean(),
})

export type OrganizationDomainAddedEventPayload = v.InferOutput<typeof organizationDomainAddedEventPayloadSchema>
